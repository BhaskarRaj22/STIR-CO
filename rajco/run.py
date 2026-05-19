#!/usr/bin/env python3
"""
RAJ & CO — Start Script
Run this file to launch the website: python run.py
Then open your browser to: http://localhost:5000
"""
import sys, os, pathlib

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'backend'))

# ── Check .env exists ─────────────────────────────────────────────────
env_path = HERE / '.env'
if not env_path.exists():
    print("=" * 60)
    print("  ⚠  .env file not found!")
    print("  Copy .env.example → .env and fill in your Gmail details.")
    print("=" * 60)
    print()

from app import app, db, seed_data

if __name__ == '__main__':
    print("=" * 60)
    print("  RAJ & CO — India's Home Marketplace")
    print("  Powered by LocalizeWise™ Technology")
    print("=" * 60)

    with app.app_context():
        db.create_all()
        seed_data()
        print("✓ Database ready")

    # Show SMTP status
    from app import SMTP_USER, SMTP_PASSWORD, ENV_FILE
    if SMTP_USER and SMTP_PASSWORD:
        print(f"✓ Email OTP configured ({SMTP_USER})")
    else:
        print("⚠  Email OTP NOT configured — edit .env first")
        print(f"  .env path: {ENV_FILE}")

    print("✓ Server starting on http://localhost:5000")
    print("  Test SMTP:  http://localhost:5000/api/auth/test-smtp")
    print("  Press Ctrl+C to stop")
    print()

    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
