# Project Risk Register & External Prerequisites

## Risk Register

| ID     | Category       | Description                                                                                                            | Rank   | Owner            | Mitigation Strategy                                                                                                      |
| :----- | :------------- | :--------------------------------------------------------------------------------------------------------------------- | :----- | :--------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **R1** | Technical      | Vite dep-optimizer fails on Cesium background Web Workers (`createVerticesFromHeightmap.js`), causing rendering halts. | High   | Frontend Lead    | Added `vite-plugin-cesium` to `vite.config.ts` and clear `.vite` cache on build setup.                                   |
| **R2** | Technical      | Coordinate conversion drift between WGS84 ellipsoid coordinates and local ENU frames leads to inaccurate path vectors. | Medium | Backend Lead     | Added unit tests asserting mathematical accuracy to within $\le 0.01$ meters.                                            |
| **R3** | Infrastructure | Campus firewall or FLIP port restrictions prevent remote access to the development server.                             | Medium | DevOps Lead      | Configured Vite to run with `--host` on high ports and documented the SSH tunneling workflow (`-L 5173:localhost:5173`). |
| **R4** | External       | Cesium ion access token rate limits hit during multi-user testing.                                                     | Low    | Integration Lead | Cached static terrain assets where possible and created fallbacks to default imagery providers.                          |

## External Prerequisites & Approvals

- **Server Account Access:** OSU FLIP environment access requested and verified for team members.
- **Third-Party Services:** Cesium ion developer key configured for map tile rendering. No external institutional or partner NDAs required.
