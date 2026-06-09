import jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = "fora_track@!secret_cle_26_tres_securisee_et_longue"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120   # Le badge expire au bout de 2 heures


def create_access_token(data: dict):
  to_encode = data.copy()
  
  # On calcule l'heure d'expiration
  expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
  to_encode.update({"exp": expire})
  
  # On génère le token crypté
  encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
  return encoded_jwt
