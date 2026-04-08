import os
import json
import time
from playwright.sync_api import sync_playwright

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        root_dir = os.getcwd()
        index_url = f"file://{root_dir}/index.html"
        creator_url = f"file://{root_dir}/creator.html"

        # 1. PWA Compliance Check
        print("Checking PWA Manifest...")
        manifest_path = os.path.join(root_dir, 'manifest.json')
        if not os.path.exists(manifest_path):
            raise Exception("manifest.json missing")

        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
            required = ['name', 'short_name', 'icons', 'start_url', 'display', 'categories', 'shortcuts']
            for field in required:
                if field not in manifest:
                    raise Exception(f"Manifest missing required field: {field}")
        print("PWA Manifest OK.")

        print("Checking Service Worker...")
        sw_path = os.path.join(root_dir, 'sw.js')
        if not os.path.exists(sw_path):
            raise Exception("sw.js missing")
        print("Service Worker OK.")

        # 2. Undo/Redo Complex Properties Test
        print("Testing Undo/Redo with Complex Properties...")
        page.goto(creator_url)
        # Wait for the CreatorApp to be attached to window
        for _ in range(20):
            if page.evaluate("window.CreatorApp !== undefined && window.CreatorApp._undo !== undefined"):
                break
            time.sleep(0.5)
        else:
            raise Exception("CreatorApp not exposed after timeout")

        page.evaluate('''() => {
            // 1. Push state BEFORE placement
            window.CreatorApp._pushUndo(); // Empty world

            // 2. Place block
            World.addBlock(5, 5, 5, 'stone', true);

            // 3. Push state BEFORE painting
            window.CreatorApp._pushUndo(); // World with stone

            // 4. Paint block (simulating what tools.js does)
            const block = World.getBlock(5, 5, 5);
            block.customColor = '#ff0000';
            BlockRenderer.removeBlock(5, 5, 5, 'stone');
            const mat = new THREE.MeshLambertMaterial({ color: '#ff0000' });
            BlockRenderer.addCustomMesh(5, 5, 5, mat);

            // Verify painted
            const b = World.getBlock(5, 5, 5);
            if (!b || b.customColor !== '#ff0000') throw new Error("Paint failed");

            // 5. Undo paint
            window.CreatorApp._undo();
            const b2 = World.getBlock(5, 5, 5);
            if (!b2) throw new Error("Undo paint failed: block missing");
            if (b2.customColor) throw new Error("Undo paint failed: color still exists: " + b2.customColor);

            // 6. Redo paint
            window.CreatorApp._redo();
            const b3 = World.getBlock(5, 5, 5);
            if (!b3 || b3.customColor !== '#ff0000') throw new Error("Redo paint failed: color missing");

            // 7. Undo paint again
            window.CreatorApp._undo();

            // 8. Undo placement
            window.CreatorApp._undo();
            if (World.getBlock(5, 5, 5)) throw new Error("Undo placement failed");

            // 9. Test 100-level stack limit
            if (window.CreatorApp._maxUndoSteps !== 100) throw new Error("Undo limit not 100");
        }''')
        print("Undo/Redo Complex Properties OK.")

        # 3. Memory Cleanup Audit (Logic Check)
        print("Auditing Memory Cleanup...")
        has_dispose = page.evaluate('''() => {
            const code = BlockRenderer.clearAll.toString();
            return code.includes('geometry.dispose()') && code.includes('material.dispose()');
        }''')
        if not has_dispose:
            raise Exception("BlockRenderer.clearAll is missing geometry/material disposal for custom meshes")
        print("Memory Cleanup Audit OK.")

        browser.close()
        print("All tests passed!")

if __name__ == "__main__":
    run_tests()
