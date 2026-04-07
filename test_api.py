import requests
import json
import time

URL = "http://127.0.0.1:8000"
DIRECTORY = r"D:\OneDrive\Área de Trabalho\Boletim Scraper\downloads\2012"
TERMS = ["portaria"]

def test_search():
    print(f"Starting test search in {DIRECTORY}...")
    try:
        # 1. Start search
        resp = requests.post(f"{URL}/api/search", json={"directory": DIRECTORY, "terms": TERMS})
        print(f"Start search response: {resp.status_code} - {resp.json()}")
        
        # 2. Poll status
        for _ in range(30):
            time.sleep(2)
            status_resp = requests.get(f"{URL}/api/status")
            state = status_resp.json()
            print(f"Progress: {state['progress']}% | Processed: {state['processed']}/{state['total']} | Results: {len(state['results'])}")
            
            if not state["is_running"] and state["progress"] >= 100:
                print("Search finished!")
                break
        
        # 3. Check results
        results_resp = requests.get(f"{URL}/api/results")
        results = results_resp.json()
        print(f"Total results found: {len(results)}")
        
        # 4. Check for errors
        status_resp = requests.get(f"{URL}/api/status")
        errors = status_resp.json().get("failed_files", [])
        if errors:
            print(f"Errors found: {len(errors)}")
        else:
            print("No files failed processing! ✅")

        # 5. Test Export XLSX
        print("Testing Excel export...")
        export_resp = requests.post(f"{URL}/api/export_selected", json={"results": results[:2]})
        if export_resp.status_code == 200 and "content" in export_resp.json():
            print(f"Excel export OK: {export_resp.json()['filename']} (Base64 length: {len(export_resp.json()['content'])})")
        else:
            print(f"Excel export FAILED: {export_resp.status_code}")

        # 6. Test Export ZIP
        print("Testing ZIP export...")
        zip_resp = requests.post(f"{URL}/api/pdf/zip_all", json={"results": results[:1]})
        if zip_resp.status_code == 200 and "content" in zip_resp.json():
            print(f"ZIP export OK: {zip_resp.json()['filename']} (Base64 length: {len(zip_resp.json()['content'])})")
        else:
            print(f"ZIP export FAILED: {zip_resp.status_code}")
            
    except Exception as e:
        print(f"Error connecting to server: {e}")

if __name__ == "__main__":
    test_search()
