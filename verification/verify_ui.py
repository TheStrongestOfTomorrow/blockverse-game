import os
import time
from playwright.sync_api import sync_playwright

def quick_ui_check():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page()

        path = os.path.abspath("index.html")
        page.goto(f"file://{path}")

        # Manually trigger the classes and styles I want to see
        page.evaluate("""
            document.getElementById('screen-auth').classList.remove('active');
            document.getElementById('screen-game').classList.add('active');
            document.getElementById('mobile-controls').classList.remove('hidden');

            // Put some text in HUD
            document.getElementById('hud-players-count').textContent = '👤 1';
            document.getElementById('hud-block-count').textContent = '🧱 100';
            document.getElementById('hud-server-info').textContent = 'Localhost';
        """)

        # Take screenshot of mobile HUD and joystick
        page.screenshot(path="verification/mobile_ui_mock.png")

        # Open Menu
        page.evaluate("""
            document.getElementById('game-menu').classList.add('active');
        """)
        page.screenshot(path="verification/mobile_menu_mock.png")

        browser.close()

if __name__ == "__main__":
    quick_ui_check()
