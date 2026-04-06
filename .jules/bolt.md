## 2024-05-15 - [O(1) Block Removal Optimization]
**Learning:** In a voxel engine with thousands of instances, linear search for block removal ($O(n)$) quickly becomes a bottleneck as the world grows. Swapping to a `Map` for instance index lookups and using `Uint32Array` for numeric block keys significantly reduces CPU time and GC pressure.
**Action:** Always prefer $O(1)$ lookups for frequently modified indexed data structures (like Three.js InstancedMesh) and use TypedArrays for dense numeric data to avoid object allocation overhead.

## 2024-05-15 - [Incremental Occlusion Culling]
**Learning:** Full-world visibility rebuilds ($O(N)$) on every block place/remove cause massive frame spikes as the world size grows. Localized $O(1)$ neighbor updates (checking 6 neighbors) effectively eliminate this overhead during gameplay.
**Action:** Transition from global rebuilds to localized, incremental updates for visibility and light propagation in voxel-based systems.
