#!/bin/bash

# 🔑 Setup SSH Key for VPS 212.85.26.253
# Copy public key ke VPS untuk passwordless authentication

VPS_IP="212.85.26.253"
PUBLIC_KEY=$(cat ~/.ssh/id_rsa.pub)

echo "🔑 Setting up SSH key authentication for VPS..."
echo "VPS IP: $VPS_IP"
echo ""
echo "📋 PUBLIC KEY to copy:"
echo "======================================"
echo "$PUBLIC_KEY"
echo "======================================"
echo ""
echo "🚀 Manual SSH Key Setup Commands:"
echo ""
echo "1. SSH ke VPS dengan password:"
echo "   ssh root@$VPS_IP"
echo ""
echo "2. Di VPS, jalankan commands ini:"
echo "   mkdir -p ~/.ssh"
echo "   echo '$PUBLIC_KEY' >> ~/.ssh/authorized_keys"
echo "   chmod 700 ~/.ssh"
echo "   chmod 600 ~/.ssh/authorized_keys"
echo "   exit"
echo ""
echo "3. Test SSH key (tanpa password):"
echo "   ssh root@$VPS_IP 'echo SSH Key Working!'"
echo ""
echo "✅ Setelah SSH key working, jalankan: ./deploy-latest.sh"