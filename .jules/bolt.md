## 2024-05-15 - [O(1) Block Removal Optimization]
**Learning:** In a voxel engine with thousands of instances, linear search for block removal ($O(n)$) quickly becomes a bottleneck as the world grows. Swapping to a `Map` for instance index lookups and using `Uint32Array` for numeric block keys significantly reduces CPU time and GC pressure.
**Action:** Always prefer $O(1)$ lookups for frequently modified indexed data structures (like Three.js InstancedMesh) and use TypedArrays for dense numeric data to avoid object allocation overhead.
