from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]/'evidence/captures'
ROOT.mkdir(exist_ok=True,parents=True)
class Handler(BaseHTTPRequestHandler):
 def do_OPTIONS(self):
  self.send_response(204);self.send_header('Access-Control-Allow-Origin',self.headers.get('Origin',''));self.send_header('Access-Control-Allow-Methods','POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','content-type');self.end_headers()
 def do_POST(self):
  name=self.path.lstrip('/')
  if self.headers.get('Origin') not in ['http://127.0.0.1:4174','http://127.0.0.1:5173','http://127.0.0.1:4173'] or not re.fullmatch(r'(gameplay|profile|frame)-[0-9]+\.(webm|json|png)',name): self.send_error(403);return
  size=int(self.headers.get('Content-Length','0'))
  if not 0<size<150_000_000:self.send_error(413);return
  (ROOT/name).write_bytes(self.rfile.read(size))
  self.send_response(200);self.send_header('Access-Control-Allow-Origin',self.headers['Origin']);self.end_headers();self.wfile.write(b'saved')
HTTPServer(('127.0.0.1',4190),Handler).serve_forever()

