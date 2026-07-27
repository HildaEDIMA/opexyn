import resend
import secrets
from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY

def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)

def send_verification_email(to_email: str, full_name: str, token: str, base_url: str = "http://localhost:8000"):
    verification_url = f"{base_url}/api/auth/verify-email?token={token}"
    
    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:'Inter',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:48px 24px;">
<div style="margin-bottom:40px;">
<svg width="160" viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg">
<polygon points="18,4 30,4 36,14 30,24 18,24 12,14" fill="none" stroke="#c8f03c" stroke-width="1.5"/>
<polygon points="21,8 27,8 30,14 27,20 21,20 18,14" fill="#c8f03c"/>
</svg>
<span style="font-size:22px;font-weight:800;color:#f0f0ee;">Opex</span><span style="font-size:22px;font-weight:800;color:#c8f03c;">yn</span>
</div>
<div style="background:#111111;border:1px solid #1e1e1e;border-radius:16px;padding:40px;">
<p style="font-size:11px;letter-spacing:3px;color:#c8f03c;margin:0 0 16px 0;">VERIFY YOUR EMAIL</p>
<h1 style="font-size:26px;font-weight:800;color:#f0f0ee;margin:0 0 16px 0;">Welcome to Opexyn.</h1>
<p style="font-size:14px;color:rgba(240,240,238,0.5);line-height:1.7;margin:0 0 32px 0;">
You're one step away from deploying your first AI employee.
Click the button below to verify your email address.
</p>
<a href="{verification_url}"
style="display:inline-block;background:#c8f03c;color:#0a0a0b;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;">
Verify my email
</a>
<p style="font-size:12px;color:rgba(240,240,238,0.25);margin:32px 0 0 0;">
This link expires in 24 hours. If you didn't create an account, ignore this email.
</p>
</div>
<p style="font-size:12px;color:rgba(240,240,238,0.2);text-align:center;margin-top:32px;">
2025 Opexyn
</p>
</div>
</body>
</html>"""
    
    try:
        print(f"[Email] Attempting to send to {to_email}...")
        print(f"[Email] API key: {settings.RESEND_API_KEY[:15] if settings.RESEND_API_KEY else 'NOT SET'}...")
        
        response = resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": [to_email],
            "subject": "Verify your email — Opexyn",
            "html": html,
        })
        print(f"[Email] Success: {response}")
        return True
    except Exception as e:
        print(f"[Email] Error: {type(e).__name__}: {e}")
        return False


def send_welcome_email(to_email: str, full_name: str):
    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:'Inter',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:48px 24px;">
<div style="background:#111111;border:1px solid #1e1e1e;border-radius:16px;padding:40px;">
<p style="font-size:11px;letter-spacing:3px;color:#c8f03c;margin:0 0 16px 0;">YOUR ACCOUNT IS READY</p>
<h1 style="font-size:26px;font-weight:800;color:#f0f0ee;margin:0 0 16px 0;">You're in.</h1>
<p style="font-size:14px;color:rgba(240,240,238,0.5);line-height:1.7;margin:0 0 32px 0;">
Your account is verified. Deploy your first AI employee and let them handle the work.
</p>
<a href="http://localhost:5173/dashboard"
style="display:inline-block;background:#c8f03c;color:#0a0a0b;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;">
Go to dashboard
</a>
</div>
</div>
</body>
</html>"""
    
    try:
        response = resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": [to_email],
            "subject": "You're in — Opexyn",
            "html": html,
        })
        print(f"[Email] Welcome email sent: {response}")
        return True
    except Exception as e:
        print(f"[Email] Welcome email error: {type(e).__name__}: {e}")
        return False