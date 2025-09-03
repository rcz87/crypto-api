import fs from 'fs';
import path from 'path';

/**
 * Auto-bump OpenAPI version when endpoints change
 * This ensures cache invalidation when API changes
 */
export class VersionManager {
  private openapiPath: string;
  
  constructor() {
    this.openapiPath = path.join(process.cwd(), 'public', 'openapi.yaml');
  }
  
  /**
   * Bump version automatically (increments patch version)
   */
  bumpVersion(): string {
    try {
      const content = fs.readFileSync(this.openapiPath, 'utf8');
      
      // Extract current version
      const versionMatch = content.match(/version:\s*['"]([\d.]+)['"]/);
      if (!versionMatch) {
        throw new Error('Version not found in OpenAPI spec');
      }
      
      const currentVersion = versionMatch[1];
      const versionParts = currentVersion.split('.');
      const major = parseInt(versionParts[0]) || 0;
      const minor = parseInt(versionParts[1]) || 0;
      const patch = parseInt(versionParts[2]) || 0;
      
      // Increment patch version
      const newVersion = `${major}.${minor}.${patch + 1}`;
      
      // Replace version in content
      const newContent = content.replace(
        /version:\s*['"]([\d.]+)['"]/,
        `version: '${newVersion}'`
      );
      
      // Write back to file
      fs.writeFileSync(this.openapiPath, newContent, 'utf8');
      
      console.log(`🚀 OpenAPI version bumped: ${currentVersion} → ${newVersion}`);
      return newVersion;
      
    } catch (error) {
      console.error('❌ Failed to bump version:', error);
      return '';
    }
  }
  
  /**
   * Get current version
   */
  getCurrentVersion(): string {
    try {
      const content = fs.readFileSync(this.openapiPath, 'utf8');
      const versionMatch = content.match(/version:\s*['"]([\d.]+)['"]/);
      return versionMatch ? versionMatch[1] : '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
  
  /**
   * Trigger version bump when endpoints are added/modified
   */
  static triggerBumpOnEndpointChange(endpointName: string) {
    const versionManager = new VersionManager();
    const newVersion = versionManager.bumpVersion();
    
    if (newVersion) {
      console.log(`📡 Endpoint '${endpointName}' modified, version bumped to ${newVersion}`);
      console.log('🔄 Cache will be invalidated automatically via ETag');
    }
  }
}