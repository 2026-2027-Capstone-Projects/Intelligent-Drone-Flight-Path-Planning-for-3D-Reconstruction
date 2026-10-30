import { Ion } from "cesium";

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
if (ionToken) {
  Ion.defaultAccessToken = ionToken;
} else {
  console.warn("VITE_CESIUM_ION_TOKEN is not set; terrain and 3D buildings will fail to load. See .env.example.");
}
