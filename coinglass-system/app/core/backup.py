import os
import subprocess
import shlex
import boto3
from datetime import datetime, timedelta
from typing import Dict, Any, List
from app.core.settings import settings
from app.core.observability import structured_logger
from app.core.cache import cache

class BackupManager:
    """Database backup and disaster recovery manager"""
    
    def __init__(self):
        self.logger = structured_logger
        self.retention_days = settings.BACKUP_RETENTION_DAYS
        self.backup_bucket = os.getenv("BACKUP_S3_BUCKET", "coinglass-backups")
        self.s3_client = self._init_s3_client()
    
    def _init_s3_client(self):
        """Initialize S3 client for backup storage"""
        try:
            return boto3.client(
                's3',
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "us-east-1")
            )
        except Exception as e:
            self.logger.warning(f"S3 client initialization failed: {e}")
            return None
    
    async def create_database_backup(self) -> Dict[str, Any]:
        """Create database backup"""
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"coinglass_backup_{timestamp}.sql"
            backup_path = f"/tmp/{backup_filename}"
            
            # Create PostgreSQL dump
            db_url = settings.DB_URL
            # Parse database connection details
            import urllib.parse as urlparse
            parsed = urlparse.urlparse(db_url)
            
            pg_dump_cmd = [
                "pg_dump",
                "-h", shlex.quote(parsed.hostname or "localhost"),
                "-p", shlex.quote(str(parsed.port or 5432)),
                "-U", shlex.quote(parsed.username or "postgres"),
                "-d", shlex.quote(parsed.path[1:]),  # Remove leading slash
                "-f", shlex.quote(backup_path),
                "--verbose",
                "--no-password"
            ]
            
            # Set password environment variable
            env = os.environ.copy()
            env["PGPASSWORD"] = parsed.password or ""
            
            # Execute backup
            result = subprocess.run(
                pg_dump_cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )
            
            if result.returncode != 0:
                raise Exception(f"pg_dump failed: {result.stderr}")
            
            # Get backup file size
            backup_size = os.path.getsize(backup_path)
            
            # Upload to S3 if configured
            s3_url = None
            if self.s3_client:
                s3_url = await self._upload_to_s3(backup_path, backup_filename)
            
            # Store backup metadata
            backup_metadata = {
                "timestamp": timestamp,
                "filename": backup_filename,
                "local_path": backup_path,
                "size_bytes": backup_size,
                "s3_url": s3_url,
                "status": "completed"
            }
            
            # Cache backup info
            cache.set(f"backup:latest", backup_metadata, ttl=86400)
            cache.set(f"backup:{timestamp}", backup_metadata, ttl=86400 * 30)
            
            self.logger.info(
                "Database backup completed",
                backup_id=timestamp,
                size_mb=backup_size / 1024 / 1024,
                s3_uploaded=s3_url is not None
            )
            
            return backup_metadata
            
        except Exception as e:
            self.logger.error(f"Database backup failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    async def _upload_to_s3(self, local_path: str, filename: str) -> str:
        """Upload backup file to S3"""
        try:
            s3_key = f"database-backups/{filename}"
            
            self.s3_client.upload_file(
                local_path,
                self.backup_bucket,
                s3_key,
                ExtraArgs={
                    'ServerSideEncryption': 'AES256',
                    'StorageClass': 'STANDARD_IA'
                }
            )
            
            return f"s3://{self.backup_bucket}/{s3_key}"
            
        except Exception as e:
            self.logger.error(f"S3 upload failed: {e}")
            raise
    
    async def restore_database(self, backup_identifier: str) -> Dict[str, Any]:
        """Restore database from backup"""
        try:
            # Get backup metadata
            backup_metadata = cache.get(f"backup:{backup_identifier}")
            if not backup_metadata:
                raise Exception(f"Backup {backup_identifier} not found")
            
            restore_path = backup_metadata.get("local_path")
            
            # Download from S3 if needed
            if not os.path.exists(restore_path) and backup_metadata.get("s3_url"):
                restore_path = await self._download_from_s3(backup_metadata["s3_url"])
            
            if not os.path.exists(restore_path):
                raise Exception(f"Backup file not found: {restore_path}")
            
            # Parse database connection
            db_url = settings.DB_URL
            import urllib.parse as urlparse
            parsed = urlparse.urlparse(db_url)
            
            # Create restore command
            psql_cmd = [
                "psql",
                "-h", shlex.quote(parsed.hostname or "localhost"),
                "-p", shlex.quote(str(parsed.port or 5432)),
                "-U", shlex.quote(parsed.username or "postgres"),
                "-d", shlex.quote(parsed.path[1:]),
                "-f", shlex.quote(restore_path),
                "--verbose"
            ]
            
            env = os.environ.copy()
            env["PGPASSWORD"] = parsed.password or ""
            
            # Execute restore
            result = subprocess.run(
                psql_cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=7200  # 2 hour timeout
            )
            
            if result.returncode != 0:
                raise Exception(f"Database restore failed: {result.stderr}")
            
            self.logger.info(
                "Database restore completed",
                backup_id=backup_identifier,
                restore_time=datetime.utcnow().isoformat()
            )
            
            return {"status": "completed", "backup_id": backup_identifier}
            
        except Exception as e:
            self.logger.error(f"Database restore failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    async def _download_from_s3(self, s3_url: str) -> str:
        """Download backup file from S3"""
        try:
            # Parse S3 URL
            s3_path = s3_url.replace("s3://", "").split("/", 1)
            bucket = s3_path[0]
            key = s3_path[1]
            
            local_path = f"/tmp/{os.path.basename(key)}"
            
            self.s3_client.download_file(bucket, key, local_path)
            return local_path
            
        except Exception as e:
            self.logger.error(f"S3 download failed: {e}")
            raise
    
    async def cleanup_old_backups(self):
        """Clean up old backup files"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.retention_days)
            
            # Clean up local files
            backup_dir = "/tmp"
            for filename in os.listdir(backup_dir):
                if filename.startswith("coinglass_backup_"):
                    file_path = os.path.join(backup_dir, filename)
                    file_time = datetime.fromtimestamp(os.path.getctime(file_path))
                    
                    if file_time < cutoff_date:
                        os.remove(file_path)
                        self.logger.info(f"Removed old backup file: {filename}")
            
            # Clean up S3 files if configured
            if self.s3_client:
                await self._cleanup_s3_backups(cutoff_date)
            
        except Exception as e:
            self.logger.error(f"Backup cleanup failed: {e}")
    
    async def _cleanup_s3_backups(self, cutoff_date: datetime):
        """Clean up old S3 backup files"""
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.backup_bucket,
                Prefix="database-backups/"
            )
            
            for obj in response.get("Contents", []):
                if obj["LastModified"].replace(tzinfo=None) < cutoff_date:
                    self.s3_client.delete_object(
                        Bucket=self.backup_bucket,
                        Key=obj["Key"]
                    )
                    self.logger.info(f"Removed old S3 backup: {obj['Key']}")
                    
        except Exception as e:
            self.logger.error(f"S3 backup cleanup failed: {e}")
    
    def get_backup_status(self) -> Dict[str, Any]:
        """Get backup system status"""
        try:
            latest_backup = cache.get("backup:latest")
            
            return {
                "backup_enabled": True,
                "s3_configured": self.s3_client is not None,
                "retention_days": self.retention_days,
                "latest_backup": latest_backup,
                "status": "healthy"
            }
        except Exception as e:
            return {
                "backup_enabled": False,
                "status": "error",
                "error": str(e)
            }

# Global instance
backup_manager = BackupManager()