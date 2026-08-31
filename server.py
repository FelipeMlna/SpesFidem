import socket
import http.server
import socketserver
import json
import os
from pathlib import Path

# Configuración
PORT = 3000
FALLBACK_PORT = 8080
DATA_DIR = Path("data")
CLIENTS_FILE = DATA_DIR / "clients.json"
BACKUP_FILE = Path("database_backup.json")

# Asegurar que el directorio y archivo de datos existen
DATA_DIR.mkdir(exist_ok=True)

def get_local_ip():
    try:
        # Create a dummy socket to connect to an external IP (doesn't actually connect)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"

if not CLIENTS_FILE.exists():
    with open(CLIENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)

class PersistentStorageHandler(http.server.SimpleHTTPRequestHandler):
    """
    Manejador avanzado que sirve archivos estáticos Y actúa como API REST
    para guardar datos en un archivo JSON local.
    """
    
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        print(f"DEBUG: Handling OPTIONS preflight for {self.path}")
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def end_headers(self):
        if not hasattr(self, '_headers_sent_flag'):
             # Ensure CORS headers are sent if not already (though usually sent manually)
             # But here we are calling send_cors_headers manually in handlers.
             pass
        super().end_headers()

    def do_GET(self):
        # Normalizar path eliminando query params para el ruteo
        path_only = self.path.split('?')[0]

        # API: Obtener todos los clientes
        if path_only == '/api/clients':
            self.send_json(self.load_clients())
            return

        # API: Obtener usuarios registrados
        if path_only == '/api/registered-users':
            users = self.load_registered_users()
            sanitized = [{
                "id": u.get("id"),
                "fullName": u.get("fullName"),
                "email": u.get("email"),
                "idCard": u.get("idCard", ""),
                "cellphone": u.get("cellphone", ""),
                "city": u.get("city", ""),
                "registrationDate": u.get("registrationDate", ""),
                "status": u.get("status", "Activo"),
                "role": u.get("role", "user")
            } for u in users]
            self.send_json(sanitized)
            return

        # API: Health Check
        if path_only == '/api/health':
            self.send_json({"status": "ok", "message": "Servidor Spesfidem Activo"})
            return

        # Comportamiento normal (servir HTML, CSS, JS)
        super().do_GET()

    def do_POST(self):
        # Normalizar path
        path_only = self.path.split('?')[0]
        # Log to server.log (if redirected) or stdout
        print(f"POST request: {self.path} -> {path_only}")

        # API: Guardar (Crear o Actualizar) Cliente
        if path_only == '/api/clients':
            # Handle CORS preflight if needed (OPTIONS) handled separately
            
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                post_data = self.rfile.read(content_length)
                try:
                    data = json.loads(post_data.decode('utf-8'))
                    print(f"Upserting data for ID: {data.get('id')}")
                    self.upsert_client(data)
                    self.send_json({"success": True, "message": "Cliente guardado correctamente."})
                except json.JSONDecodeError:
                    print("Error: Invalid JSON on POST /api/clients")
                    # Send error with CORS
                    self.send_response(400)
                    self.send_cors_headers()
                    self.end_headers()
                    self.wfile.write(b"JSON invalido")
            return

        # API: Login Administrativo
        if path_only == '/api/login':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                credentials = json.loads(post_data.decode('utf-8'))
                user = credentials.get('username')
                password = credentials.get('password')

                print(f"INFO: Login attempt - User: '{user}', Pass Length: {len(password) if password else 0}")

                # Credenciales proporcionadas por el usuario (4 Administradores con Nombre)
                users_db = {
                    '14298116': {'pass': '14298116Je*', 'name': 'Jhon Espinosa'},
                    '1106227253': {'pass': '7253pipe', 'name': 'Felipe Molina'},
                    '1005703432': {'pass': '3432sergio', 'name': 'Sergio Suarez'},
                    '1104942399': {'pass': '2399caleb', 'name': 'Caleb Perez'}
                }

                if user in users_db:
                    user_data = users_db[user]
                    expected_password = user_data['pass']
                    is_valid = (expected_password == password)
                    print(f"DEBUG: User '{user}' found. Password match: {is_valid}")
                    
                    if is_valid:
                        print(f"SUCCESS: User {user} ({user_data['name']}) logged in.")
                        self.send_json({
                            "success": True, 
                            "token": "BASIC_AUTH_SUCCESS",
                            "name": user_data['name'] 
                        })
                    else:
                        print(f"WARN: Password mismatch for user {user}. Received '{password}'")
                        self.send_response(401)
                        self.send_cors_headers()
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            "success": False, 
                            "message": "Contraseña incorrecta"
                        }).encode('utf-8'))
                else:
                    print(f"WARN: User '{user}' not found.")
                    self.send_response(401)
                    self.send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "success": False, 
                        "message": "Documento no registrado"
                    }).encode('utf-8'))
            except Exception as e:
                print(f"ERROR: Login Exception: {e}")
                self.send_error(400, "Solicitud de login inválida")
        if path_only == '/api/logout':
            self.send_json({ "success": True, "message": "Sesión cerrada correctamente" })
            return

        self.send_error(405, "Método POST no permitido para este recurso")

    def do_DELETE(self):
        # API: Permanently Empty Trash
        if self.path.split('?')[0].rstrip('/') == '/api/clients/trash':
            try:
                self.empty_trash()
                self.send_json({"success": True, "message": "Papelera vaciada permanentemente."})
            except Exception as e:
                self.send_error(500, str(e))
            return

        # API: Soft or Hard Delete Cliente por ID
        if self.path.startswith('/api/clients/'):
            try:
                # Extract ID and check for permanent flag
                parts = self.path.split('?')
                client_id = parts[0].split('/')[-1]
                is_permanent = len(parts) > 1 and "permanent=true" in parts[1]

                if is_permanent:
                    self.hard_delete_client(client_id)
                    self.send_json({"success": True, "message": "Cliente eliminado permanentemente."})
                else:
                    self.delete_client(client_id)
                    self.send_json({"success": True, "message": "Cliente movido a la papelera."})
            except Exception as e:
                print(f"Error in DELETE /api/clients: {e}")
                self.send_error(500, str(e))
            return
            
        self.send_error(404, "Endpoint no encontrado")

    def send_json(self, data):
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-type", "application/json")
        # Headers para evitar caché en API
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    # --- Métodos Auxiliares de Base de Datos ---

    def load_clients(self):
        try:
            with open(CLIENTS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def save_clients_to_disk(self, clients):
        new_content = json.dumps(clients, indent=4, ensure_ascii=False)
        try:
            if CLIENTS_FILE.exists():
                with open(CLIENTS_FILE, 'r', encoding='utf-8') as f:
                    if f.read() == new_content:
                        return # Skip write if content is identical
        except Exception:
            pass

        # Guardar en ubicación principal (data/)
        with open(CLIENTS_FILE, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        # Guardar copia de respaldo en la carpeta principal del proyecto
        try:
            with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"DEBUG: Respaldo guardado en {BACKUP_FILE.absolute()}")
        except Exception as e:
            print(f"ERROR al guardar respaldo: {e}")

    def upsert_client(self, new_client):
        clients = self.load_clients()
        # Buscar índice si ya existe (por ID)
        index = next((i for i, c in enumerate(clients) if str(c.get('id')) == str(new_client.get('id'))), None)
        
        if index is not None:
            print(f"Upsert: Matching client found at index {index} (ID: {new_client.get('id')})")
            # Allow updating 'deleted' status if provided, otherwise preserve old value
            if 'deleted' in new_client:
                print(f"Upsert: Updating deleted status from {clients[index].get('deleted')} to {new_client['deleted']}")
                clients[index]['deleted'] = new_client['deleted']
            elif 'deleted' in clients[index]:
                new_client['deleted'] = clients[index]['deleted']
            
            # Update other fields
            clients[index].update(new_client) 
            
            # Ensure serial continuity if name/data updated
            if 'serial' not in clients[index] or not clients[index]['serial']:
                # Find max serial
                max_serial = max([c.get('serial', 0) for c in clients])
                clients[index]['serial'] = max_serial + 1
        else:
            print(f"Upsert: New client (ID: {new_client.get('id')})")
            # Assign serial if missing
            if 'serial' not in new_client:
                max_serial = max([c.get('serial', 0) for c in clients] + [0])
                new_client['serial'] = max_serial + 1
            clients.append(new_client) # Insertar nuevo
            
        self.save_clients_to_disk(clients)

    def delete_client(self, client_id):
        clients = self.load_clients()
        # Soft Delete: Find and mark as deleted
        found = False
        for client in clients:
            if str(client.get('id')) == str(client_id):
                client['deleted'] = True
                found = True
                break
        
        if found:
            self.save_clients_to_disk(clients)
        else:
            print(f"WARN: Delete failed. Client ID {client_id} not found.")

    def empty_trash(self):
        clients = self.load_clients()
        original_count = len(clients)
        # Keep only clients that are NOT deleted
        clients = [c for c in clients if not c.get('deleted')]
        new_count = len(clients)
        print(f"Trash Emptied: {original_count - new_count} records removed permanently.")
        self.save_clients_to_disk(clients)

    def hard_delete_client(self, client_id):
        clients = self.load_clients()
        original_count = len(clients)
        # Remove the client with the matching ID
        clients = [c for c in clients if str(c.get('id')) != str(client_id)]
        new_count = len(clients)
        if original_count != new_count:
            print(f"Hard Deleted: Client {client_id} removed permanently.")
            self.save_clients_to_disk(clients)
        else:
            print(f"WARN: Hard Delete failed. Client ID {client_id} not found.")

class ThreadedTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def run_server(port):
    print(f"--- SERVIDOR DE PERSISTENCIA SPESFIDEM ---")
    print(f"Estado: ACTIVO")
    print(f"Intento en Puerto: {port}")
    print(f"Almacenamiento: {CLIENTS_FILE.absolute()}")
    print(f"Respaldo: {BACKUP_FILE.absolute()}")
    print(f"------------------------------------------")
    local_ip = get_local_ip()
    
    try:
        with ThreadedTCPServer(("", port), PersistentStorageHandler) as httpd:
            print(f" ACCESO LOCAL:   http://localhost:{port}")
            print(f" ACCESO RED:     http://{local_ip}:{port}")
            print(f"------------------------------------------")
            httpd.serve_forever()
    except PermissionError:
        if port == 80:
            print(f"ERROR: No hay permiso para usar el puerto 80 (necesita sudo).")
            print(f"Intentando puerto alternativo {FALLBACK_PORT}...")
            run_server(FALLBACK_PORT)
        else:
            print(f"ERROR de permisos en puerto {port}.")
    except OSError as e:
        if port == 80:
            print(f"ERROR: El puerto 80 está ocupado.")
            print(f"Intentando puerto alternativo {FALLBACK_PORT}...")
            run_server(FALLBACK_PORT)
        else:
            print(f"ERROR: Puerto {port} ocupado o inaccesible.")
            print(f"Detalle: {e}")
    except KeyboardInterrupt:
        print("\nServidor detenido.")

if __name__ == "__main__":
    run_server(PORT)
