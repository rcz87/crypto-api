import os, time
from openai import OpenAI
from shell_executor import run_shell
from log_reader import get_pm2_logs
from notifier import send_telegram
from config import OPENAI_KEY

client = OpenAI(api_key=OPENAI_KEY)

def extract_bash(response):
    if "```bash" in response:
        return response.split("```bash")[1].split("```")[0].strip()
    return None

def autonomous_loop():
    while True:
        logs = get_pm2_logs()
        send_telegram("📡 Monitoring logs...")

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Kamu AI DevOps. Jika ada error, berikan langsung solusi bash. Format harus: ```bash <command>```"},
                {"role": "user", "content": logs}
            ]
        ).choices[0].message.content

        cmd = extract_bash(response)
        if cmd:
            send_telegram(f"⚙️ AI mengusulkan perintah:\n{cmd}")
            result = run_shell(cmd)
            send_telegram(f"✅ Hasil eksekusi:\n{result}")
        else:
            send_telegram("✅ Tidak ada error yang butuh tindakan.")

        time.sleep(30)

if __name__ == "__main__":
    autonomous_loop()
