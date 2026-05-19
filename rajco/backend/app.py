from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os, random, string, math, pathlib, smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ─────────────────────────────────────────────────────────────────────────────
#  .ENV LOADER  (no third-party lib needed — works on Windows 7 + Python 3.8)
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent   # rajco/
ENV_FILE  = BASE_DIR / '.env'

def _load_env():
    env = {}
    if ENV_FILE.exists():
        for raw in ENV_FILE.read_text(encoding='utf-8').splitlines():
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, _, v = line.partition('=')
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

_env = _load_env()

def cfg(key, default=''):
    return _env.get(key) or os.environ.get(key, default)

# ─────────────────────────────────────────────────────────────────────────────
#  SMTP CONFIG  — values come from  rajco/.env
# ─────────────────────────────────────────────────────────────────────────────
SMTP_HOST     = cfg('SMTP_HOST',     'smtp.gmail.com')
SMTP_PORT     = int(cfg('SMTP_PORT', '587'))
SMTP_USER     = cfg('SMTP_USER',     '')
SMTP_PASSWORD = cfg('SMTP_PASSWORD', '')
FROM_NAME     = cfg('FROM_NAME',     'Raj & Co')

# ─────────────────────────────────────────────────────────────────────────────
#  FLASK APP
# ─────────────────────────────────────────────────────────────────────────────
app = Flask(
    __name__,
    template_folder=str(BASE_DIR / 'frontend' / 'templates'),
    static_folder=str(BASE_DIR / 'frontend' / 'static'),
)
app.config['SECRET_KEY']                  = cfg('SECRET_KEY', 'rajco-secret-2024')
app.config['SQLALCHEMY_DATABASE_URI']     = 'sqlite:///' + str(BASE_DIR / 'backend' / 'rajco.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app)
db = SQLAlchemy(app)

# ─────────────────────────────────────────────────────────────────────────────
#  MODELS
# ─────────────────────────────────────────────────────────────────────────────
class User(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    full_name   = db.Column(db.String(120), nullable=False)
    phone       = db.Column(db.String(15),  unique=True, nullable=False)
    email       = db.Column(db.String(120), unique=True, nullable=True)
    address     = db.Column(db.String(255))
    city        = db.Column(db.String(80))
    state       = db.Column(db.String(80))
    pin_code    = db.Column(db.String(10))
    lat         = db.Column(db.Float, default=0.0)
    lng         = db.Column(db.Float, default=0.0)
    is_vendor   = db.Column(db.Boolean, default=False)
    is_verified = db.Column(db.Boolean, default=False)
    otp         = db.Column(db.String(6))
    otp_expiry  = db.Column(db.DateTime)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

class Vendor(db.Model):
    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('user.id'))
    business_name  = db.Column(db.String(120))
    category       = db.Column(db.String(50))
    subcategory    = db.Column(db.String(100))
    description    = db.Column(db.Text)
    phone          = db.Column(db.String(15))
    email          = db.Column(db.String(120))
    city           = db.Column(db.String(80))
    state          = db.Column(db.String(80))
    pin_code       = db.Column(db.String(10))
    lat            = db.Column(db.Float)
    lng            = db.Column(db.Float)
    rating         = db.Column(db.Float,   default=4.0)
    reviews_count  = db.Column(db.Integer, default=0)
    is_verified    = db.Column(db.Boolean, default=True)
    image_url      = db.Column(db.String(255))
    tags           = db.Column(db.String(255))
    experience_years = db.Column(db.Integer, default=5)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

class Product(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    vendor_id    = db.Column(db.Integer, db.ForeignKey('vendor.id'))
    name         = db.Column(db.String(120))
    category     = db.Column(db.String(50))
    subcategory  = db.Column(db.String(100))
    description  = db.Column(db.Text)
    price_min    = db.Column(db.Float)
    price_max    = db.Column(db.Float)
    unit         = db.Column(db.String(20))
    image_url    = db.Column(db.String(255))
    is_bestseller = db.Column(db.Boolean, default=False)
    in_catalog   = db.Column(db.Boolean, default=True)

class Deal(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    vendor_id   = db.Column(db.Integer, db.ForeignKey('vendor.id'))
    product_id  = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=True)
    title       = db.Column(db.String(200))
    description = db.Column(db.Text)
    status      = db.Column(db.String(30), default='inquiry')
    amount      = db.Column(db.Float, nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime, default=datetime.utcnow)

class Message(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    deal_id    = db.Column(db.Integer, db.ForeignKey('deal.id'))
    sender_id  = db.Column(db.Integer, db.ForeignKey('user.id'))
    content    = db.Column(db.Text)
    msg_type   = db.Column(db.String(20), default='text')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class OTPStore(db.Model):
    id     = db.Column(db.Integer, primary_key=True)
    phone  = db.Column(db.String(15))
    email  = db.Column(db.String(120))
    otp    = db.Column(db.String(6))
    expiry = db.Column(db.DateTime)
    used   = db.Column(db.Boolean, default=False)

# ─────────────────────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def vendor_to_dict(v):
    return {
        'id': v.id, 'business_name': v.business_name, 'category': v.category,
        'subcategory': v.subcategory or '', 'description': v.description or '',
        'phone': v.phone, 'email': v.email or '', 'city': v.city, 'state': v.state,
        'pin_code': v.pin_code, 'lat': v.lat, 'lng': v.lng,
        'rating': v.rating, 'reviews_count': v.reviews_count,
        'is_verified': v.is_verified, 'image_url': v.image_url or '',
        'tags': v.tags or '', 'experience_years': v.experience_years,
    }

def product_to_dict(p):
    return {
        'id': p.id, 'vendor_id': p.vendor_id, 'name': p.name,
        'category': p.category, 'subcategory': p.subcategory or '',
        'description': p.description or '',
        'price_min': p.price_min, 'price_max': p.price_max, 'unit': p.unit,
        'image_url': p.image_url or '', 'is_bestseller': p.is_bestseller,
    }

# ─────────────────────────────────────────────────────────────────────────────
#  EMAIL SENDER  — reads credentials fresh from .env on every call
# ─────────────────────────────────────────────────────────────────────────────
def send_otp_email(to_email: str, otp: str):
    """
    Send a branded OTP email via Gmail SMTP (TLS port 587).
    Raises a descriptive RuntimeError on any failure so callers can
    return a friendly message to the frontend.
    """
    # Re-read .env on every call so updates take effect without restarting
    env       = _load_env()
    host      = env.get('SMTP_HOST')      or os.environ.get('SMTP_HOST',     'smtp.gmail.com')
    port      = int(env.get('SMTP_PORT')  or os.environ.get('SMTP_PORT',     '587'))
    user      = env.get('SMTP_USER')      or os.environ.get('SMTP_USER',     '')
    password  = env.get('SMTP_PASSWORD')  or os.environ.get('SMTP_PASSWORD', '')
    from_name = env.get('FROM_NAME')      or os.environ.get('FROM_NAME',     'Raj & Co')

    if not user or not password:
        raise RuntimeError(
            'SMTP credentials missing in .env — set SMTP_USER and SMTP_PASSWORD'
        )

    html_body = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f0ebe3;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ebe3;padding:40px 0">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0"
           style="background:#0D0D0D;border-radius:16px;overflow:hidden">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#C9A84C,#9A7A32);
                   padding:28px 36px;text-align:center">
          <div style="font-size:30px;font-weight:700;color:#0D0D0D;
                      font-family:Georgia,serif;letter-spacing:1px">
            Raj &amp; Co
          </div>
          <div style="font-size:11px;color:rgba(13,13,13,0.65);
                      letter-spacing:3px;margin-top:4px">
            LOCALIZEWISE&trade;
          </div>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:40px 36px">
          <p style="color:#F5F0E8;font-size:16px;margin:0 0 6px 0">
            Your verification code
          </p>
          <p style="color:#A89880;font-size:13px;margin:0 0 24px 0">
            Use this OTP to complete your login / registration on Raj &amp; Co.
          </p>

          <!-- OTP Box -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center"
                  style="background:#1A1A1A;border:1px solid rgba(201,168,76,0.35);
                         border-radius:12px;padding:30px">
                <span style="font-size:52px;font-weight:700;
                             letter-spacing:14px;color:#C9A84C;
                             font-family:Georgia,serif">
                  {otp}
                </span>
              </td>
            </tr>
          </table>

          <p style="color:#A89880;font-size:13px;line-height:1.7;margin:24px 0 0 0">
            &bull; This code expires in <strong style="color:#F5F0E8">10 minutes</strong>.<br>
            &bull; Never share this code with anyone.<br>
            &bull; If you did not request this, simply ignore this email.
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:18px 36px;border-top:1px solid #242424;text-align:center">
          <span style="color:#3A3A3A;font-size:12px">
            &copy; 2024 Raj &amp; Co &middot; India's Home Marketplace
          </span>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""

    msg = MIMEMultipart('alternative')
    msg['Subject'] = f'{otp} — Your Raj & Co verification code'
    msg['From']    = f'{from_name} <{user}>'
    msg['To']      = to_email
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    try:
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(user, password)
            server.sendmail(user, [to_email], msg.as_string())
        print(f'[OTP] Delivered to {to_email}')
    except smtplib.SMTPAuthenticationError:
        raise RuntimeError(
            'Gmail authentication failed.\n'
            'Fix: go to myaccount.google.com → Security → enable 2-Step Verification,\n'
            'then myaccount.google.com/apppasswords → create App Password → paste into .env'
        )
    except smtplib.SMTPConnectError as e:
        raise RuntimeError(f'Cannot connect to {host}:{port} — check internet connection. ({e})')
    except smtplib.SMTPException as e:
        raise RuntimeError(f'SMTP error: {e}')
    except OSError as e:
        raise RuntimeError(f'Network error while sending email: {e}')

# ─────────────────────────────────────────────────────────────────────────────
#  AUTH ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/auth/test-smtp', methods=['GET'])
def test_smtp():
    """Quick diagnostic — call /api/auth/test-smtp in browser to check config."""
    env = _load_env()
    user = env.get('SMTP_USER') or os.environ.get('SMTP_USER', '')
    pwd  = env.get('SMTP_PASSWORD') or os.environ.get('SMTP_PASSWORD', '')
    host = env.get('SMTP_HOST') or 'smtp.gmail.com'
    port = int(env.get('SMTP_PORT') or '587')

    status = {
        'env_file_found': ENV_FILE.exists(),
        'env_file_path':  str(ENV_FILE),
        'smtp_host':      host,
        'smtp_port':      port,
        'smtp_user_set':  bool(user),
        'smtp_user':      user if user else '(not set)',
        'smtp_password_set': bool(pwd),
    }
    if not user or not pwd:
        status['error'] = 'SMTP_USER or SMTP_PASSWORD not set in .env'
        return jsonify(status), 400

    try:
        with smtplib.SMTP(host, port, timeout=10) as s:
            s.ehlo(); s.starttls(); s.ehlo()
            s.login(user, pwd)
        status['connection'] = 'SUCCESS — SMTP login worked!'
        return jsonify(status)
    except Exception as e:
        status['connection'] = f'FAILED: {e}'
        return jsonify(status), 400


@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    data  = request.json or {}
    phone = data.get('phone', '').strip()
    email = data.get('email', '').strip()

    # ── Validate inputs ──
    if not phone or not phone.isdigit() or len(phone) < 10:
        return jsonify({'success': False, 'message': 'Enter a valid 10-digit phone number'})
    if not email or '@' not in email or '.' not in email.split('@')[-1]:
        return jsonify({'success': False, 'message': 'Enter a valid email address — the OTP will be sent there'})

    otp    = generate_otp()
    expiry = datetime.utcnow() + timedelta(minutes=10)

    # ── Save OTP (invalidate old ones for same phone) ──
    OTPStore.query.filter_by(phone=phone, used=False).update({'used': True})
    db.session.add(OTPStore(phone=phone, email=email, otp=otp, expiry=expiry, used=False))
    db.session.commit()

    # ── Send email ──
    try:
        send_otp_email(email, otp)
        return jsonify({
            'success': True,
            'message': f'OTP sent to {email}. Check your inbox (and spam folder).'
        })
    except RuntimeError as e:
        # Store the OTP even if email fails so admin can retrieve from logs
        print(f'[OTP EMAIL FAILED] phone={phone} otp={otp} error={e}')
        return jsonify({'success': False, 'message': str(e)})
    except Exception as e:
        print(f'[OTP UNEXPECTED ERROR] {e}')
        return jsonify({'success': False, 'message': f'Unexpected error: {e}'})


@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    data  = request.json or {}
    phone = data.get('phone', '').strip()
    otp   = data.get('otp', '').strip()

    if not phone or not otp:
        return jsonify({'success': False, 'message': 'Phone and OTP are required'})

    record = OTPStore.query.filter_by(phone=phone, otp=otp, used=False)\
                           .order_by(OTPStore.id.desc()).first()
    if not record:
        return jsonify({'success': False, 'message': 'Incorrect OTP. Please try again.'})
    if record.expiry < datetime.utcnow():
        return jsonify({'success': False, 'message': 'OTP has expired. Click "Send OTP" again.'})

    record.used = True
    db.session.commit()
    return jsonify({'success': True, 'message': 'OTP verified'})


@app.route('/api/auth/register', methods=['POST'])
def register():
    data      = request.json or {}
    phone     = data.get('phone', '').strip()
    email     = data.get('email', '').strip() or None
    user_type = data.get('user_type', 'customer')
    city      = data.get('city', '').strip()
    city_ll   = CITY_COORDS.get(city, {'lat': 20.5937, 'lng': 78.9629})

    # ── Returning user: log them in ──
    existing = User.query.filter_by(phone=phone).first()
    if existing:
        session['user_id']   = existing.id
        session['user_name'] = existing.full_name
        vendor = Vendor.query.filter_by(user_id=existing.id).first()
        return jsonify({'success': True, 'message': 'Logged in', 'user': {
            'id': existing.id, 'name': existing.full_name,
            'is_vendor': vendor is not None,
            'vendor_id': vendor.id if vendor else None,
        }})

    # ── New user ──
    user = User(
        full_name   = data.get('full_name', 'User'),
        phone       = phone,
        email       = email,
        address     = data.get('address', ''),
        city        = city,
        state       = data.get('state', ''),
        pin_code    = data.get('pin_code', ''),
        is_verified = True,
        is_vendor   = (user_type == 'vendor'),
        lat         = city_ll['lat'],
        lng         = city_ll['lng'],
    )
    db.session.add(user)
    db.session.flush()

    # ── Vendor: create Vendor record ──
    vendor_obj = None
    if user_type == 'vendor':
        shop_name  = data.get('shop_name', data.get('full_name', ''))
        category   = data.get('category', 'hardware')
        listing    = data.get('listing', '')
        gst_number = data.get('gst_number', '')

        vendor_obj = Vendor(
            user_id        = user.id,
            business_name  = shop_name,
            category       = category,
            subcategory    = '',
            description    = listing,
            phone          = phone,
            email          = email or '',
            city           = city,
            state          = data.get('state', ''),
            pin_code       = data.get('pin_code', ''),
            lat            = city_ll['lat'] + random.uniform(-0.02, 0.02),
            lng            = city_ll['lng'] + random.uniform(-0.02, 0.02),
            rating         = 4.0,
            reviews_count  = 0,
            is_verified    = False,
            tags           = gst_number,
            experience_years = 0,
            image_url      = f'/static/images/vendor-{category}.jpg',
        )
        db.session.add(vendor_obj)

    db.session.commit()
    session['user_id']   = user.id
    session['user_name'] = user.full_name

    return jsonify({'success': True, 'user': {
        'id': user.id, 'name': user.full_name,
        'is_vendor': vendor_obj is not None,
        'vendor_id': vendor_obj.id if vendor_obj else None,
    }})


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/auth/me', methods=['GET'])
def me():
    uid = session.get('user_id')
    if not uid:
        return jsonify({'logged_in': False})
    user = User.query.get(uid)
    if not user:
        return jsonify({'logged_in': False})
    vendor = Vendor.query.filter_by(user_id=uid).first()
    return jsonify({'logged_in': True, 'user': {
        'id': user.id, 'name': user.full_name, 'phone': user.phone,
        'email': user.email, 'city': user.city, 'state': user.state,
        'is_vendor': vendor is not None,
        'vendor_id': vendor.id if vendor else None,
    }})

# ─────────────────────────────────────────────────────────────────────────────
#  VENDOR ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/vendors', methods=['GET'])
def get_vendors():
    category   = request.args.get('category')
    subcategory = request.args.get('subcategory')
    city        = request.args.get('city')
    lat         = request.args.get('lat',    type=float)
    lng         = request.args.get('lng',    type=float)
    radius      = request.args.get('radius', 5, type=float)

    q = Vendor.query
    if category:   q = q.filter_by(category=category)
    if subcategory: q = q.filter_by(subcategory=subcategory)
    if city:       q = q.filter(Vendor.city.ilike(f'%{city}%'))
    vendors = q.all()

    if lat and lng:
        vendors = [v for v in vendors
                   if v.lat and v.lng and haversine(lat, lng, v.lat, v.lng) <= radius]

    return jsonify({'vendors': [vendor_to_dict(v) for v in vendors]})


@app.route('/api/vendors/<int:vid>', methods=['GET'])
def get_vendor(vid):
    v        = Vendor.query.get_or_404(vid)
    products = Product.query.filter_by(vendor_id=vid).all()
    return jsonify({'vendor': vendor_to_dict(v),
                    'products': [product_to_dict(p) for p in products]})


@app.route('/api/vendors/nearby', methods=['POST'])
def vendors_nearby():
    data     = request.json or {}
    lat      = data.get('lat')
    lng      = data.get('lng')
    radius   = data.get('radius', 5)
    category = data.get('category')

    q = Vendor.query
    if category:
        q = q.filter_by(category=category)
    nearby = []
    for v in q.all():
        if v.lat and v.lng:
            dist = haversine(lat, lng, v.lat, v.lng)
            if dist <= radius:
                vd = vendor_to_dict(v)
                vd['distance_km'] = round(dist, 2)
                nearby.append(vd)
    nearby.sort(key=lambda x: x['distance_km'])
    return jsonify({'vendors': nearby})

# ─────────────────────────────────────────────────────────────────────────────
#  PRODUCT ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/products', methods=['GET'])
def get_products():
    category   = request.args.get('category')
    subcategory = request.args.get('subcategory')
    bestseller  = request.args.get('bestseller')

    q = Product.query
    if category:   q = q.filter_by(category=category)
    if subcategory: q = q.filter_by(subcategory=subcategory)
    if bestseller: q = q.filter_by(is_bestseller=True)

    return jsonify({'products': [product_to_dict(p) for p in q.all()]})

# ─────────────────────────────────────────────────────────────────────────────
#  DEAL / CHAT ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/deals', methods=['POST'])
def create_deal():
    uid = session.get('user_id')
    if not uid:
        return jsonify({'success': False, 'message': 'Login required'})
    data  = request.json or {}
    deal  = Deal(
        customer_id = uid,
        vendor_id   = data['vendor_id'],
        product_id  = data.get('product_id'),
        title       = data['title'],
        description = data.get('description', ''),
        status      = 'inquiry',
    )
    db.session.add(deal)
    db.session.flush()
    db.session.add(Message(
        deal_id   = deal.id,
        sender_id = uid,
        content   = data.get('description', 'New inquiry started'),
        msg_type  = 'text',
    ))
    db.session.commit()
    return jsonify({'success': True, 'deal_id': deal.id})


@app.route('/api/deals', methods=['GET'])
def get_deals():
    uid = session.get('user_id')
    if not uid:
        return jsonify({'success': False})
    vendor = Vendor.query.filter_by(user_id=uid).first()
    if vendor:
        deals = Deal.query.filter_by(vendor_id=vendor.id).order_by(Deal.updated_at.desc()).all()
    else:
        deals = Deal.query.filter_by(customer_id=uid).order_by(Deal.updated_at.desc()).all()

    result = []
    for d in deals:
        customer = User.query.get(d.customer_id)
        v        = Vendor.query.get(d.vendor_id)
        result.append({
            'id': d.id, 'title': d.title, 'status': d.status,
            'amount': d.amount, 'created_at': d.created_at.isoformat(),
            'customer_name': customer.full_name if customer else 'Unknown',
            'vendor_name':   v.business_name   if v        else 'Unknown',
            'description':   d.description,
        })
    return jsonify({'deals': result})


@app.route('/api/deals/<int:did>/messages', methods=['GET'])
def get_messages(did):
    uid = session.get('user_id')
    if not uid:
        return jsonify({'success': False})
    msgs   = Message.query.filter_by(deal_id=did).order_by(Message.created_at).all()
    result = []
    for m in msgs:
        sender = User.query.get(m.sender_id)
        result.append({
            'id': m.id, 'content': m.content, 'msg_type': m.msg_type,
            'sender_name': sender.full_name if sender else 'Unknown',
            'sender_id':   m.sender_id,
            'created_at':  m.created_at.isoformat(),
        })
    return jsonify({'messages': result, 'current_user_id': uid})


@app.route('/api/deals/<int:did>/messages', methods=['POST'])
def send_message(did):
    uid = session.get('user_id')
    if not uid:
        return jsonify({'success': False})
    data = request.json or {}
    deal = Deal.query.get(did)
    if deal:
        deal.updated_at = datetime.utcnow()
    db.session.add(Message(
        deal_id   = did,
        sender_id = uid,
        content   = data.get('content', ''),
        msg_type  = data.get('msg_type', 'text'),
    ))
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/deals/<int:did>/status', methods=['PUT'])
def update_deal_status(did):
    uid = session.get('user_id')
    if not uid:
        return jsonify({'success': False})
    data  = request.json or {}
    deal  = Deal.query.get_or_404(did)
    deal.status     = data['status']
    deal.updated_at = datetime.utcnow()
    if 'amount' in data and data['amount']:
        deal.amount = data['amount']
    db.session.add(Message(
        deal_id   = did,
        sender_id = uid,
        content   = f"Status updated to: {data['status']}",
        msg_type  = 'status',
    ))
    db.session.commit()
    return jsonify({'success': True})

# ─────────────────────────────────────────────────────────────────────────────
#  STATIC PAGE (SPA catch-all)
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/')
@app.route('/<path:path>')
def index(path=''):
    return render_template('index.html')

# ─────────────────────────────────────────────────────────────────────────────
#  CITY COORDINATES
# ─────────────────────────────────────────────────────────────────────────────
CITY_COORDS = {
    'Mumbai':    {'lat': 19.0760, 'lng': 72.8777},
    'Delhi':     {'lat': 28.6139, 'lng': 77.2090},
    'Bangalore': {'lat': 12.9716, 'lng': 77.5946},
    'Pune':      {'lat': 18.5204, 'lng': 73.8567},
    'Chennai':   {'lat': 13.0827, 'lng': 80.2707},
    'Hyderabad': {'lat': 17.3850, 'lng': 78.4867},
    'Ahmedabad': {'lat': 23.0225, 'lng': 72.5714},
    'Kolkata':   {'lat': 22.5726, 'lng': 88.3639},
    'Surat':     {'lat': 21.1702, 'lng': 72.8311},
    'Jaipur':    {'lat': 26.9124, 'lng': 75.7873},
    'Nagpur':    {'lat': 21.1458, 'lng': 79.0882},
    'Lucknow':   {'lat': 26.8467, 'lng': 80.9462},
    'Bhopal':    {'lat': 23.2599, 'lng': 77.4126},
    'Indore':    {'lat': 22.7196, 'lng': 75.8577},
    'Nashik':    {'lat': 19.9975, 'lng': 73.7898},
}

# ─────────────────────────────────────────────────────────────────────────────
#  SEED DATA
# ─────────────────────────────────────────────────────────────────────────────
def seed_data():
    if Vendor.query.count() > 0:
        return

    vendors_data = [
        {'business_name': 'Sharma Lock & Hardware',     'category': 'hardware', 'subcategory': 'Locks & Security',       'city': 'Mumbai',    'state': 'Maharashtra', 'phone': '9876543210', 'rating': 4.5, 'reviews_count': 128, 'tags': 'locks,door handles,security',   'experience_years': 12, 'description': 'Premium locks, door handles and security hardware. Authorized dealer of Godrej and Yale.'},
        {'business_name': 'Patel Hardware Emporium',    'category': 'hardware', 'subcategory': 'Curtain Rods & Fixtures', 'city': 'Ahmedabad', 'state': 'Gujarat',     'phone': '9876543211', 'rating': 4.2, 'reviews_count':  87, 'tags': 'curtain rods,fixtures,knobs',   'experience_years':  8, 'description': 'Best curtain bars with knobs, curtain brackets and all types of home fixtures.'},
        {'business_name': 'Delhi Hardware Palace',      'category': 'hardware', 'subcategory': 'Locks & Security',       'city': 'Delhi',     'state': 'Delhi',       'phone': '9876543212', 'rating': 4.7, 'reviews_count': 203, 'tags': 'locks,deadbolts,padlocks',      'experience_years': 20, 'description': 'North India largest hardware store with 5000+ products.'},
        {'business_name': 'Mehta Door Fittings',        'category': 'hardware', 'subcategory': 'Door & Window Hardware', 'city': 'Pune',      'state': 'Maharashtra', 'phone': '9876543213', 'rating': 4.3, 'reviews_count':  65, 'tags': 'hinges,handles,bolts',          'experience_years': 15, 'description': 'Complete door and window hardware solutions.'},
        {'business_name': 'Joshi Curtain & Hardware',   'category': 'hardware', 'subcategory': 'Curtain Rods & Fixtures','city': 'Nagpur',    'state': 'Maharashtra', 'phone': '9876543214', 'rating': 4.1, 'reviews_count':  42, 'tags': 'curtain bars,rods,knobs',       'experience_years':  6, 'description': 'Specializing in curtain rods, bars with decorative knobs.'},
        {'business_name': 'Bangalore Lock Store',       'category': 'hardware', 'subcategory': 'Locks & Security',       'city': 'Bangalore', 'state': 'Karnataka',   'phone': '9876543215', 'rating': 4.6, 'reviews_count': 156, 'tags': 'smart locks,CCTV,security',     'experience_years': 10, 'description': 'Modern security solutions including smart locks and digital systems.'},
        {'business_name': 'Rajasthan Marble House',     'category': 'tiles',    'subcategory': 'Marble Flooring',        'city': 'Jaipur',    'state': 'Rajasthan',   'phone': '9876543220', 'rating': 4.8, 'reviews_count': 312, 'tags': 'marble,granite,Italian marble', 'experience_years': 25, 'description': 'Direct importer of Italian, Indian marble. Premium quality at wholesale prices.'},
        {'business_name': 'Mumbai Tile World',          'category': 'tiles',    'subcategory': 'Ceramic Tiles',          'city': 'Mumbai',    'state': 'Maharashtra', 'phone': '9876543221', 'rating': 4.4, 'reviews_count': 189, 'tags': 'ceramic tiles,vitrified,floor',  'experience_years': 18, 'description': 'Largest tile showroom in Western India. Johnson, Kajaria, Nitco dealer.'},
        {'business_name': 'Granite King Bangalore',     'category': 'tiles',    'subcategory': 'Granite & Stone',        'city': 'Bangalore', 'state': 'Karnataka',   'phone': '9876543222', 'rating': 4.5, 'reviews_count':  98, 'tags': 'granite,countertop,kitchen',    'experience_years': 14, 'description': 'Premium granite slabs for kitchen countertops, flooring and wall cladding.'},
        {'business_name': 'Hyderabad Tiles Gallery',    'category': 'tiles',    'subcategory': 'Designer Tiles',         'city': 'Hyderabad', 'state': 'Telangana',   'phone': '9876543223', 'rating': 4.6, 'reviews_count': 145, 'tags': 'designer tiles,mosaic,bathroom', 'experience_years': 11, 'description': 'Exclusive designer tiles, mosaic and luxury bathroom tiles.'},
        {'business_name': 'Pune Marble & Granite',      'category': 'tiles',    'subcategory': 'Marble Flooring',        'city': 'Pune',      'state': 'Maharashtra', 'phone': '9876543224', 'rating': 4.3, 'reviews_count':  76, 'tags': 'marble,flooring,polishing',     'experience_years':  9, 'description': 'Marble supply and installation with polishing services.'},
        {'business_name': 'Chennai Tile Mart',          'category': 'tiles',    'subcategory': 'Ceramic Tiles',          'city': 'Chennai',   'state': 'Tamil Nadu',  'phone': '9876543225', 'rating': 4.2, 'reviews_count':  88, 'tags': 'tiles,bathroom,kitchen',        'experience_years':  7, 'description': 'Complete tile solutions for home and commercial spaces.'},
        {'business_name': 'Ravi Colour Works',          'category': 'painter',  'subcategory': 'Interior Painting',      'city': 'Mumbai',    'state': 'Maharashtra', 'phone': '9876543230', 'rating': 4.7, 'reviews_count': 234, 'tags': 'interior,Asian Paints,texture',  'experience_years': 15, 'description': 'Expert interior and exterior painting with texture, waterproofing specialist.'},
        {'business_name': 'Delhi Decor Painters',       'category': 'painter',  'subcategory': 'Texture & Wall Art',     'city': 'Delhi',     'state': 'Delhi',       'phone': '9876543231', 'rating': 4.8, 'reviews_count': 178, 'tags': 'texture painting,wall art,3D',   'experience_years': 12, 'description': 'Specializing in luxury texture painting, 3D wall effects and artistic murals.'},
        {'business_name': 'Suresh Painting Services',   'category': 'painter',  'subcategory': 'Exterior Painting',      'city': 'Pune',      'state': 'Maharashtra', 'phone': '9876543232', 'rating': 4.4, 'reviews_count': 112, 'tags': 'exterior,waterproof,commercial', 'experience_years': 20, 'description': 'Commercial and residential exterior painting with waterproofing.'},
        {'business_name': 'Bangalore Paint Masters',    'category': 'painter',  'subcategory': 'Interior Painting',      'city': 'Bangalore', 'state': 'Karnataka',   'phone': '9876543233', 'rating': 4.5, 'reviews_count':  89, 'tags': 'interior,premium,Berger',        'experience_years':  8, 'description': 'Premium interior painting services using top brands.'},
        {'business_name': 'Kolkata Color House',        'category': 'painter',  'subcategory': 'Waterproofing',          'city': 'Kolkata',   'state': 'West Bengal', 'phone': '9876543234', 'rating': 4.3, 'reviews_count':  67, 'tags': 'waterproofing,roof,basement',    'experience_years': 16, 'description': 'Waterproofing specialist for roofs, bathrooms and basements.'},
        {'business_name': 'Royal Curtain Studio',       'category': 'decor',    'subcategory': 'Curtains & Drapes',      'city': 'Mumbai',    'state': 'Maharashtra', 'phone': '9876543240', 'rating': 4.9, 'reviews_count': 267, 'tags': 'curtains,drapes,blinds,custom',  'experience_years': 18, 'description': 'Luxury customized curtains, drapes and blinds. Over 500 fabric choices.'},
        {'business_name': 'Carpet World Delhi',         'category': 'decor',    'subcategory': 'Carpets & Rugs',         'city': 'Delhi',     'state': 'Delhi',       'phone': '9876543241', 'rating': 4.6, 'reviews_count': 198, 'tags': 'carpets,rugs,Persian,wool',      'experience_years': 22, 'description': 'Imported and handmade carpets, Persian rugs and modern area rugs.'},
        {'business_name': 'Bedsheet Paradise',          'category': 'decor',    'subcategory': 'Bedsheets & Linen',      'city': 'Surat',     'state': 'Gujarat',     'phone': '9876543242', 'rating': 4.5, 'reviews_count': 145, 'tags': 'bedsheets,linen,cotton,silk',    'experience_years': 10, 'description': 'Premium cotton, silk and designer bedsheets. Wholesale and retail.'},
        {'business_name': 'Pune Curtain Corner',        'category': 'decor',    'subcategory': 'Curtains & Drapes',      'city': 'Pune',      'state': 'Maharashtra', 'phone': '9876543243', 'rating': 4.4, 'reviews_count':  93, 'tags': 'curtains,motorized,blackout',    'experience_years':  7, 'description': 'Motorized and manual curtains, blackout solutions for homes and offices.'},
        {'business_name': 'Chennai Home Decor Hub',     'category': 'decor',    'subcategory': 'Carpets & Rugs',         'city': 'Chennai',   'state': 'Tamil Nadu',  'phone': '9876543244', 'rating': 4.3, 'reviews_count':  56, 'tags': 'carpets,floor mats,doormats',    'experience_years':  5, 'description': 'Wide range of carpets, floor mats and decorative rugs.'},
        {'business_name': 'Lucknow Chikankari Decor',  'category': 'decor',    'subcategory': 'Bedsheets & Linen',      'city': 'Lucknow',   'state': 'Uttar Pradesh','phone': '9876543245', 'rating': 4.7, 'reviews_count': 134, 'tags': 'chikankari,handmade,ethnic',     'experience_years': 30, 'description': 'Traditional Chikankari and handloom bedsheets. Authentic Lucknawi craft.'},
        {'business_name': 'Bangalore Blind & Curtain',  'category': 'decor',    'subcategory': 'Curtains & Drapes',      'city': 'Bangalore', 'state': 'Karnataka',   'phone': '9876543246', 'rating': 4.5, 'reviews_count':  87, 'tags': 'blinds,curtains,office',         'experience_years': 11, 'description': 'Venetian blinds, roller blinds and custom curtains for modern homes.'},
    ]

    products_map = {
        'hardware': [
            {'name': 'Godrej Mortise Lock',      'price_min':  800, 'price_max':  2500, 'unit': 'piece',  'is_bestseller': True,  'subcategory': 'Mortise Locks'},
            {'name': 'Yale Digital Smart Lock',  'price_min': 5000, 'price_max': 15000, 'unit': 'piece',  'is_bestseller': True,  'subcategory': 'Smart Locks'},
            {'name': 'Curtain Rod with Knob',    'price_min':  200, 'price_max':   800, 'unit': 'piece',  'is_bestseller': False, 'subcategory': 'Curtain Rods'},
            {'name': 'Door Handle Set',          'price_min':  350, 'price_max':  1200, 'unit': 'set',    'is_bestseller': True,  'subcategory': 'Door Handles'},
        ],
        'tiles': [
            {'name': 'Italian Marble Slab',      'price_min':  180, 'price_max':   450, 'unit': 'sq ft',  'is_bestseller': True,  'subcategory': 'Marble'},
            {'name': 'Vitrified Floor Tile',     'price_min':   45, 'price_max':   120, 'unit': 'sq ft',  'is_bestseller': True,  'subcategory': 'Vitrified'},
            {'name': 'Designer Wall Tile',       'price_min':   60, 'price_max':   200, 'unit': 'sq ft',  'is_bestseller': False, 'subcategory': 'Wall Tiles'},
            {'name': 'Granite Countertop',       'price_min':  120, 'price_max':   350, 'unit': 'sq ft',  'is_bestseller': True,  'subcategory': 'Granite'},
        ],
        'painter': [
            {'name': 'Interior Painting',        'price_min':   12, 'price_max':    25, 'unit': 'sq ft',  'is_bestseller': True,  'subcategory': 'Interior'},
            {'name': 'Texture Painting',         'price_min':   30, 'price_max':    80, 'unit': 'sq ft',  'is_bestseller': True,  'subcategory': 'Texture'},
            {'name': 'Exterior Painting',        'price_min':   18, 'price_max':    35, 'unit': 'sq ft',  'is_bestseller': False, 'subcategory': 'Exterior'},
            {'name': 'Waterproofing Treatment',  'price_min':   40, 'price_max':    90, 'unit': 'sq ft',  'is_bestseller': True,  'subcategory': 'Waterproofing'},
        ],
        'decor': [
            {'name': 'Custom Curtains',          'price_min':  300, 'price_max':  2000, 'unit': 'meter',  'is_bestseller': True,  'subcategory': 'Curtains'},
            {'name': 'Persian Area Rug',         'price_min': 2000, 'price_max': 25000, 'unit': 'piece',  'is_bestseller': True,  'subcategory': 'Rugs'},
            {'name': 'Premium Bedsheet Set',     'price_min':  800, 'price_max':  5000, 'unit': 'set',    'is_bestseller': True,  'subcategory': 'Bedsheets'},
            {'name': 'Motorized Blind',          'price_min': 1500, 'price_max':  8000, 'unit': 'piece',  'is_bestseller': False, 'subcategory': 'Blinds'},
        ],
    }

    for vd in vendors_data:
        city   = vd['city']
        coords = CITY_COORDS.get(city, {'lat': 20.5937, 'lng': 78.9629})
        lat    = coords['lat'] + random.uniform(-0.03, 0.03)
        lng    = coords['lng'] + random.uniform(-0.03, 0.03)

        owner = User(
            full_name=vd['business_name'] + ' Owner',
            phone=vd['phone'], city=vd['city'], state=vd['state'],
            is_verified=True, lat=lat, lng=lng,
        )
        db.session.add(owner)
        db.session.flush()

        vendor = Vendor(
            user_id=owner.id, business_name=vd['business_name'],
            category=vd['category'], subcategory=vd['subcategory'],
            description=vd['description'], phone=vd['phone'],
            city=vd['city'], state=vd['state'], pin_code='400001',
            lat=lat, lng=lng, rating=vd['rating'],
            reviews_count=vd['reviews_count'], is_verified=True,
            tags=vd['tags'], experience_years=vd['experience_years'],
            image_url=f'/static/images/vendor-{vd["category"]}.jpg',
        )
        db.session.add(vendor)
        db.session.flush()

        for pd in products_map.get(vd['category'], []):
            db.session.add(Product(
                vendor_id=vendor.id, name=pd['name'],
                category=vd['category'], subcategory=pd['subcategory'],
                description=f"Premium {pd['name']} from {vd['business_name']}",
                price_min=pd['price_min'], price_max=pd['price_max'],
                unit=pd['unit'], is_bestseller=pd['is_bestseller'],
                image_url=f'/static/images/product-{vd["category"]}.jpg',
            ))

    db.session.commit()
    print('[SEED] 24 vendors + products seeded successfully')


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_data()
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
