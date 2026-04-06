import os
from playwright.sync_api import sync_playwright

def capture_screenshots():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Using a typical 1080p viewport
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        root_dir = os.getcwd()
        lobby_url = f"file://{root_dir}/index.html"
        creator_url = f"file://{root_dir}/creator.html"

        # Mock a logged-in user in localStorage
        # Key: bv_auth, Value: {"username":"Bolt","loginTime":1715788800000}
        # Key: bv_user_Bolt, Value: {"username":"Bolt","passwordHash":"...","avatar":{...}}
        auth_json = '{"username":"Bolt","loginTime":1715788800000}'
        user_json = '{"username":"Bolt","avatar":{"bodyColor":"#3F51B5","headShape":"default","bodyShape":"default","accessory":"none"}}'

        print("Capturing Lobby...")
        page.goto(lobby_url)
        page.evaluate(f"localStorage.setItem('bv_auth', '{auth_json}')")
        page.evaluate(f"localStorage.setItem('bv_user_Bolt', '{user_json}')")
        page.reload()

        # Wait for the lobby to appear
        page.wait_for_selector(".lobby-layout", timeout=10000)
        page.wait_for_timeout(1000) # Let it settle
        page.screenshot(path="verification/lobby_discovery.png")

        print("Capturing Creator Studio...")
        page.goto(creator_url)
        page.wait_for_selector(".creator-body", timeout=10000)
        page.wait_for_timeout(2000)
        page.screenshot(path="verification/creator_studio_layout.png")

        print("Capturing Hierarchy and Selection...")
        # Click "Generate Terrain" to populate blocks
        gen_btn = page.locator("button:has-text('Generate Terrain')")
        if gen_btn.is_visible():
            gen_btn.click()
            page.wait_for_timeout(2000) # Wait for generation

        # Expand Workspace
        expand = page.locator(".node-row:has-text('Workspace') .expand-icon")
        if expand.is_visible():
            expand.click()
            page.wait_for_timeout(500)

        # Click a block node in the hierarchy
        node = page.locator(".node-content:has-text('Block')").first
        if node.is_visible():
            node.click()
            page.wait_for_timeout(1000)
            page.screenshot(path="verification/creator_selection_props.png")

        browser.close()

if __name__ == "__main__":
    capture_screenshots()
