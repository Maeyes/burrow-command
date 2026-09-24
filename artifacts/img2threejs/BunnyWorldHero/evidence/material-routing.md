# Material evidence routing

Reference PBR extraction is **not applicable** to this reconstruction.

The source is a painted concept/turnaround sheet with baked illustration highlights and shadows, not a calibrated photograph or texture source. Treating those pixels as measured albedo, roughness, normal, or ambient-occlusion evidence would encode the sheet's lighting into the runtime materials.

The material system therefore uses the sheet only for discrete palette regions:

- warm cream primary fur: `#F3E9DE`, roughness 0.78
- lighter muzzle/tail: `#FFF7F0`, roughness 0.82
- inner ear: `#ECA8AA`, roughness 0.70
- warm reddish-brown iris: `#9C351D`, roughness 0.16 with clearcoat
- dark pupil/rim: `#281817`, roughness 0.12 with clearcoat
- muted pink nose: `#D98286`, roughness 0.42

All are solid procedural Three.js materials with no image textures, fur noise, or projected shading. These assignments are wired into `object-sculpt-spec.json` and the generated/refined factory.
