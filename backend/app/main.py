import os, secrets, hashlib, uuid, base64
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Integer, Boolean, ForeignKey, DateTime, JSON, select
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature

DATABASE_URL=os.environ["DATABASE_URL"]
BOOTSTRAP_TOKEN=os.environ["BOOTSTRAP_TOKEN"]
if len(BOOTSTRAP_TOKEN)<24:
    raise RuntimeError("BOOTSTRAP_TOKEN precisa ter ao menos 24 caracteres")
engine=create_engine(DATABASE_URL,pool_pre_ping=True)
SessionLocal=sessionmaker(bind=engine)
class Base(DeclarativeBase): pass
class Shop(Base):
    __tablename__="shops"
    id=Column(String,primary_key=True,default=lambda:str(uuid.uuid4()))
    name=Column(String(160),nullable=False)
    branding=Column(JSON,default=dict,nullable=False)
class Product(Base):
    __tablename__="products"
    id=Column(String,primary_key=True,default=lambda:str(uuid.uuid4()))
    shop_id=Column(String,ForeignKey("shops.id"),nullable=False,index=True)
    name=Column(String(160),nullable=False)
    price_cents=Column(Integer,nullable=False)
    min_qty=Column(Integer,default=1,nullable=False)
    increment=Column(Integer,default=1,nullable=False)
    stock=Column(Integer,default=0,nullable=False)
    enabled=Column(Boolean,default=True,nullable=False)
class Activation(Base):
    __tablename__="activations"
    id=Column(String,primary_key=True,default=lambda:str(uuid.uuid4()))
    shop_id=Column(String,ForeignKey("shops.id"),nullable=False)
    token_hash=Column(String(64),unique=True,nullable=False)
    expires_at=Column(DateTime(timezone=True),nullable=False)
    used=Column(Boolean,default=False,nullable=False)
class Device(Base):
    __tablename__="devices"
    shop_id=Column(String,ForeignKey("shops.id"),primary_key=True)
    public_key=Column(String,nullable=False)
    activated_at=Column(DateTime(timezone=True),nullable=False)
class Challenge(Base):
    __tablename__="challenges"
    id=Column(String,primary_key=True,default=lambda:str(uuid.uuid4()))
    shop_id=Column(String,ForeignKey("shops.id"),nullable=False)
    nonce=Column(String,nullable=False)
    expires_at=Column(DateTime(timezone=True),nullable=False)
    used=Column(Boolean,default=False,nullable=False)
@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    yield
app=FastAPI(title="Doce Ateliê Multi-loja — Homologação",lifespan=lifespan)
origins=[s.strip() for s in os.getenv("CORS_ORIGINS","").split(",") if s.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_methods=["GET","POST","PUT"],allow_headers=["Content-Type","X-Bootstrap-Token","X-Challenge-Id","X-Signature"])
def session():
    with SessionLocal() as db: yield db
def bootstrap(x_bootstrap_token:str=Header(default="")):
    if not secrets.compare_digest(x_bootstrap_token,BOOTSTRAP_TOKEN):
        raise HTTPException(403,"Acesso de operador negado")
def now(): return datetime.now(timezone.utc)
def aware(d): return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
def shop_or_404(db,shop_id):
    obj=db.get(Shop,shop_id)
    if obj is None: raise HTTPException(404,"Loja não encontrada")
    return obj
class ShopIn(BaseModel):
    name:str=Field(min_length=2,max_length=160)
    branding:dict={}
class ProductIn(BaseModel):
    name:str=Field(min_length=1,max_length=160)
    price_cents:int=Field(ge=0)
    min_qty:int=Field(default=1,ge=1)
    increment:int=Field(default=1,ge=1)
    stock:int=Field(default=0,ge=0)
    enabled:bool=True
class ActivationIn(BaseModel):
    code:str
    public_key:str
class SignatureIn(BaseModel):
    challenge_id:str
    signature:str
@app.get("/health")
def health(): return {"status":"ok"}
@app.post("/operator/shops",dependencies=[Depends(bootstrap)])
def create_shop(body:ShopIn,db:Session=Depends(session)):
    obj=Shop(name=body.name,branding=body.branding)
    db.add(obj);db.commit();db.refresh(obj)
    return {"shop_id":obj.id,"name":obj.name}
@app.get("/shops/{shop_id}/catalog")
def catalog(shop_id:str,db:Session=Depends(session)):
    shop=shop_or_404(db,shop_id)
    products=db.scalars(select(Product).where(Product.shop_id==shop_id,Product.enabled==True)).all()
    return {"shop":{"id":shop.id,"name":shop.name,"branding":shop.branding},"products":[{"id":p.id,"name":p.name,"price_cents":p.price_cents,"min_qty":p.min_qty,"increment":p.increment,"stock":p.stock} for p in products]}
@app.post("/operator/shops/{shop_id}/activation",dependencies=[Depends(bootstrap)])
def issue_activation(shop_id:str,db:Session=Depends(session)):
    shop_or_404(db,shop_id)
    code=secrets.token_urlsafe(24)
    db.add(Activation(shop_id=shop_id,token_hash=hashlib.sha256(code.encode()).hexdigest(),expires_at=now()+timedelta(minutes=15)))
    db.commit()
    return {"activation_code":code,"expires_in_seconds":900}
@app.post("/shops/{shop_id}/activate")
def activate(shop_id:str,body:ActivationIn,db:Session=Depends(session)):
    shop_or_404(db,shop_id)
    try:
        key=base64.b64decode(body.public_key,validate=True)
        if len(key)!=32: raise ValueError()
        Ed25519PublicKey.from_public_bytes(key)
    except Exception: raise HTTPException(422,"Chave pública Ed25519 inválida")
    token_hash=hashlib.sha256(body.code.encode()).hexdigest()
    activation=db.scalar(select(Activation).where(Activation.shop_id==shop_id,Activation.token_hash==token_hash).with_for_update())
    if activation is None or activation.used or aware(activation.expires_at)<now():
        raise HTTPException(403,"Código inválido, usado ou expirado")
    activation.used=True
    device=db.get(Device,shop_id)
    if device is None: db.add(Device(shop_id=shop_id,public_key=body.public_key,activated_at=now()))
    else: device.public_key=body.public_key;device.activated_at=now()
    db.commit()
    return {"activated":True,"previous_device_revoked":True}
@app.post("/shops/{shop_id}/challenge")
def challenge(shop_id:str,db:Session=Depends(session)):
    shop_or_404(db,shop_id)
    if not db.get(Device,shop_id): raise HTTPException(403,"Nenhum administrador ativado")
    obj=Challenge(shop_id=shop_id,nonce=secrets.token_urlsafe(32),expires_at=now()+timedelta(minutes=2))
    db.add(obj);db.commit();db.refresh(obj)
    return {"challenge_id":obj.id,"nonce":obj.nonce,"expires_in_seconds":120}
def verify(db,shop_id,body):
    c=db.scalar(select(Challenge).where(Challenge.id==body.challenge_id,Challenge.shop_id==shop_id).with_for_update())
    device=db.get(Device,shop_id)
    if not c or not device or c.used or aware(c.expires_at)<now():
        raise HTTPException(403,"Desafio inválido ou expirado")
    try:
        key=Ed25519PublicKey.from_public_bytes(base64.b64decode(device.public_key,validate=True))
        key.verify(base64.b64decode(body.signature,validate=True),c.nonce.encode())
    except (InvalidSignature,ValueError,TypeError):
        raise HTTPException(403,"Assinatura inválida")
    c.used=True
@app.post("/shops/{shop_id}/admin/verify")
def verify_admin(shop_id:str,body:SignatureIn,db:Session=Depends(session)):
    verify(db,shop_id,body);db.commit()
    return {"authorized":True}
class SignedProduct(BaseModel):
    challenge_id:str
    signature:str
    product:ProductIn
@app.post("/shops/{shop_id}/admin/products")
def create_product(shop_id:str,body:SignedProduct,db:Session=Depends(session)):
    shop_or_404(db,shop_id)
    verify(db,shop_id,body)
    p=Product(shop_id=shop_id,**body.product.model_dump())
    db.add(p);db.commit();db.refresh(p)
    return {"product_id":p.id}
