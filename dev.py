from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from api.stock import handler
from api.pulso import handler as pulso_handler
from api.nexo import handler as nexo_handler
class Dev(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path=='/api/stock': return handler.do_POST(self)
        if self.path=='/api/pulso': return pulso_handler.do_POST(self)
        if self.path=='/api/nexo': return nexo_handler.do_POST(self)
        self.send_error(404)
ThreadingHTTPServer(('127.0.0.1',8000),Dev).serve_forever()
