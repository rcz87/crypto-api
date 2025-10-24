import subprocess

def get_pm2_logs():
    try:
        return subprocess.check_output("pm2 logs crypto-api --lines 30 --nostream",
                                       shell=True, stderr=subprocess.STDOUT).decode()
    except:
        return "Gagal mengambil log PM2"
