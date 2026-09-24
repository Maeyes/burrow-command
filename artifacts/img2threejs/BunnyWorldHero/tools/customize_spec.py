import copy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "object-sculpt-spec.json"
DETAIL_PATH = ROOT / "detail-inventory.json"

MATERIAL_HEX = {
    "hidden": "#000000",
    "fur-cream": "#F3E9DE",
    "fur-light": "#FFF7F0",
    "ear-pink": "#ECA8AA",
    "eye-white": "#FFF8F0",
    "iris-brown": "#9C351D",
    "eye-dark": "#281817",
    "catchlight": "#FFFFFF",
    "nose-pink": "#D98286",
    "mouth-dark": "#5A2D31",
}


def rgba_for(material):
    value = MATERIAL_HEX.get(material, "#FFFFFF").lstrip("#")
    r, g, b = (int(value[i:i + 2], 16) for i in (0, 2, 4))
    return f"rgba({r}, {g}, {b}, 1.0)"


def material_class_for(material):
    if material in {"eye-white", "iris-brown", "eye-dark", "catchlight"}:
        return "glass"
    if material == "hidden":
        return "unknown"
    if material in {"nose-pink", "mouth-dark"}:
        return "rubber"
    return "skin"


def deep_clone(value):
    return copy.deepcopy(value)


spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
details = json.loads(DETAIL_PATH.read_text(encoding="utf-8"))["detailInventory"]
component_template = deep_clone(spec["componentTree"][0])
attachment_template = deep_clone(next(c["attachment"] for c in spec["componentTree"] if c.get("attachment")))
material_template = deep_clone(spec["materials"][0])


def feature(fid, description, evidence="bunny-hero-reference.png"):
    return {
        "id": fid,
        "type": "reference-defined",
        "description": description,
        "geometryEffect": "explicit geometry or material region",
        "materialEffect": "reference palette assignment",
        "evidenceRef": evidence,
        "confidence": 0.94,
    }


def socket(name, position, forward=(0, 0, 1), up=(0, 1, 0)):
    return {
        "id": name,
        "name": name,
        "localPosition": list(position),
        "forward": list(forward),
        "up": list(up),
        "purpose": "future weapon attachment; intentionally empty in static reconstruction",
    }


def component(
    cid,
    name,
    parent,
    primitive,
    position,
    dimensions,
    material,
    *,
    level="macro",
    role="body",
    rotation=(0, 0, 0),
    importance=0.85,
    confidence=0.92,
    topology="continuous-sculpt",
    local_features=None,
    sockets=None,
):
    c = deep_clone(component_template)
    c.update(
        {
            "id": cid,
            "name": name,
            "level": level,
            "role": role,
            "importance": importance,
            "confidence": confidence,
            "primitive": primitive,
            "topologyClass": topology,
            "topologyRationale": f"{name} is represented as a smooth, lightweight stylized volume whose silhouette is defined by the reference turnaround.",
            "parent": parent,
            "dimensions": {
                "width": dimensions[0],
                "height": dimensions[1],
                "depth": dimensions[2],
                "units": "meters",
                "confidence": confidence,
            },
            "transform": {
                "position": list(position),
                "rotation": list(rotation),
                "scale": list(dimensions),
            },
            "material": material,
            "materialLayers": [material],
            "localFeatures": local_features or [],
            "evidenceRefs": ["full-object"],
            "fidelityTier": "reference-critical" if importance >= 0.9 else "supporting",
        }
    )
    c["geometryDescriptor"].update(
        {
            "topologyIntent": "lightweight stylized organic game character",
            "uvStrategy": "generated procedural coordinates",
            "normalStrategy": "smooth vertex normals",
        }
    )
    c["geometryDescriptor"]["edgeTreatment"] = {
        "type": "soft-rounded",
        "bevelRadius": 0.008,
        "segments": 2,
    }
    c["surfaceDetail"] = {
        "macroRoughness": 0.08,
        "microRoughness": 0.02,
        "bumpAmplitude": 0.0,
        "normalPattern": "none",
        "displacementPattern": "none",
        "occlusionPattern": "contact-only",
        "edgeWearPattern": "none",
        "notes": "Smooth stylized surface; no realistic fur microstructure.",
    }
    if parent is None:
        c["attachment"] = None
    else:
        a = deep_clone(attachment_template)
        a.update(
            {
                "parentSocket": f"{parent}-{cid}",
                "localStart": list(position),
                "localEnd": [position[0], position[1] + max(dimensions[1] * 0.35, 0.02), position[2]],
                "contactType": "overlap",
                "baseRadius": max(min(dimensions) * 0.35, 0.01),
                "endRadius": max(min(dimensions) * 0.28, 0.008),
                "embedDepth": 0.025,
                "gapTolerance": 0.005,
                "evidenceRefs": ["full-object"],
            }
        )
        c["attachment"] = a
    c["actionProfile"]["animationRole"] = "future-articulated" if role in {"head", "ear", "arm", "hand", "leg", "foot", "tail"} else "static"
    c["actionProfile"]["sockets"] = sockets or []
    c["actionProfile"]["destruction"]["breakable"] = False
    c["actionProfile"]["destruction"]["debrisMaterial"] = material
    c["colorMaterialRecipe"] = {
        "dominantAlbedo": rgba_for(material),
        "secondaryAlbedo": rgba_for(material),
        "materialClass": material_class_for(material),
        "materialClassConfidence": 0.9,
        "source": "locked concept-sheet palette",
        "materialId": material,
        "finish": "solid stylized PBR",
        "evidenceRefs": ["full-object"],
    }
    return c


components = [
    component("root", "BunnyWorldHero root", None, "box", (0, 0, 0), (0.01, 0.01, 0.01), "hidden", role="root", topology="assembled-solid", importance=1.0),
    component("body", "Compact pear body", "root", "ellipsoid", (0, 0.35, 0), (0.36, 0.46, 0.30), "fur-cream", role="body", importance=1.0, local_features=[feature("palette-regions", "Warm cream primary body region")]),
    component("head", "Oversized rounded head", "root", "ellipsoid", (0, 0.73, 0.015), (0.47, 0.42, 0.38), "fur-cream", role="head", importance=1.0, local_features=[feature("head-tufts", "Sparse crown and cheek silhouette accents")]),
    component("muzzle-l", "Left rounded muzzle", "head", "ellipsoid", (0.055, -0.075, 0.165), (0.15, 0.105, 0.09), "fur-light", level="meso", role="face", importance=0.92),
    component("muzzle-r", "Right rounded muzzle", "head", "ellipsoid", (-0.055, -0.075, 0.165), (0.15, 0.105, 0.09), "fur-light", level="meso", role="face", importance=0.92),
    component("ear-l", "Left long floppy ear", "head", "ellipsoid", (0.245, 0.0, -0.025), (0.17, 0.55, 0.095), "fur-cream", role="ear", rotation=(0.04, -0.05, -0.34), importance=1.0, local_features=[feature("inner-ear-insets", "Pink inset with cream perimeter")]),
    component("ear-r", "Right long floppy ear", "head", "ellipsoid", (-0.245, 0.0, -0.025), (0.17, 0.55, 0.095), "fur-cream", role="ear", rotation=(0.04, 0.05, 0.34), importance=1.0),
    component("inner-ear-l", "Left inner ear", "ear-l", "ellipsoid", (0.0, -0.005, 0.053), (0.105, 0.455, 0.018), "ear-pink", level="meso", role="surface", importance=0.9, topology="conforming-shell"),
    component("inner-ear-r", "Right inner ear", "ear-r", "ellipsoid", (0.0, -0.005, 0.053), (0.105, 0.455, 0.018), "ear-pink", level="meso", role="surface", importance=0.9, topology="conforming-shell"),
    component("eye-l", "Left eye white and rim", "head", "ellipsoid", (0.115, 0.025, 0.167), (0.135, 0.165, 0.055), "eye-white", level="meso", role="eye", importance=1.0, local_features=[feature("eye-assemblies", "Glossy layered reddish-brown eye with catchlights")]),
    component("eye-r", "Right eye white and rim", "head", "ellipsoid", (-0.115, 0.025, 0.167), (0.135, 0.165, 0.055), "eye-white", level="meso", role="eye", importance=1.0),
    component("iris-l", "Left warm brown iris", "eye-l", "ellipsoid", (0.0, -0.003, 0.032), (0.098, 0.125, 0.022), "iris-brown", level="micro", role="eye", importance=1.0, topology="surface-relief"),
    component("iris-r", "Right warm brown iris", "eye-r", "ellipsoid", (0.0, -0.003, 0.032), (0.098, 0.125, 0.022), "iris-brown", level="micro", role="eye", importance=1.0, topology="surface-relief"),
    component("pupil-l", "Left pupil", "iris-l", "ellipsoid", (0.0, 0.003, 0.014), (0.052, 0.078, 0.012), "eye-dark", level="micro", role="eye", importance=0.95, topology="surface-relief"),
    component("pupil-r", "Right pupil", "iris-r", "ellipsoid", (0.0, 0.003, 0.014), (0.052, 0.078, 0.012), "eye-dark", level="micro", role="eye", importance=0.95, topology="surface-relief"),
    component("catchlight-l", "Left eye catchlight", "pupil-l", "sphere", (-0.018, 0.035, 0.011), (0.022, 0.022, 0.012), "catchlight", level="micro", role="eye", importance=0.9, topology="surface-relief"),
    component("catchlight-r", "Right eye catchlight", "pupil-r", "sphere", (0.018, 0.035, 0.011), (0.022, 0.022, 0.012), "catchlight", level="micro", role="eye", importance=0.9, topology="surface-relief"),
    component("nose", "Tiny pink nose", "head", "ellipsoid", (0, -0.068, 0.223), (0.048, 0.035, 0.025), "nose-pink", level="micro", role="face", importance=0.95, local_features=[feature("nose", "Tiny centered muted-pink nose")]),
    component("mouth-l", "Left neutral mouth curve", "head", "torus", (0.023, -0.098, 0.222), (0.052, 0.035, 0.01), "mouth-dark", level="micro", role="face", rotation=(1.57, 0, 0.28), importance=0.86, topology="surface-relief", local_features=[feature("neutral-mouth", "Restrained W-shaped neutral mouth")]),
    component("mouth-r", "Right neutral mouth curve", "head", "torus", (-0.023, -0.098, 0.222), (0.052, 0.035, 0.01), "mouth-dark", level="micro", role="face", rotation=(1.57, 0, -0.28), importance=0.86, topology="surface-relief"),
    component("arm-l", "Left short arm", "body", "capsule", (0.205, 0.05, 0.035), (0.105, 0.245, 0.105), "fur-cream", role="arm", rotation=(0, 0, -0.13), importance=0.9),
    component("arm-r", "Right short arm", "body", "capsule", (-0.205, 0.05, 0.035), (0.105, 0.245, 0.105), "fur-cream", role="arm", rotation=(0, 0, 0.13), importance=0.9),
    component("hand-l", "Left rounded paw", "arm-l", "ellipsoid", (0.020, -0.11, 0.020), (0.11, 0.105, 0.10), "fur-cream", level="meso", role="hand", importance=0.9, local_features=[feature("paw-pad-groups", "Muted pink paw-pad group on underside")], sockets=[socket("weapon-socket-l", (0, -0.02, 0.055))]),
    component("hand-r", "Right rounded paw", "arm-r", "ellipsoid", (-0.020, -0.11, 0.020), (0.11, 0.105, 0.10), "fur-cream", level="meso", role="hand", importance=0.9, sockets=[socket("weapon-socket-r", (0, -0.02, 0.055))]),
    component("leg-l", "Left short leg", "body", "capsule", (0.105, -0.20, 0.0), (0.13, 0.20, 0.13), "fur-cream", role="leg", importance=0.86),
    component("leg-r", "Right short leg", "body", "capsule", (-0.105, -0.20, 0.0), (0.13, 0.20, 0.13), "fur-cream", role="leg", importance=0.86),
    component("foot-l", "Left rounded foot", "leg-l", "ellipsoid", (0.010, -0.085, 0.07), (0.165, 0.12, 0.225), "fur-cream", role="foot", importance=0.93),
    component("foot-r", "Right rounded foot", "leg-r", "ellipsoid", (-0.010, -0.085, 0.07), (0.165, 0.12, 0.225), "fur-cream", role="foot", importance=0.93),
    component("tail", "Small fluffy tail", "body", "sphere", (0, -0.05, -0.19), (0.145, 0.145, 0.145), "fur-light", role="tail", importance=0.82, local_features=[feature("tail-cluster", "Clustered scalloped fluffy tail silhouette")]),
]

# Reference-driven organic profiles that cannot be represented faithfully by straight ellipsoids.
by_id = {item["id"]: item for item in components}
body = by_id["body"]
body["primitive"] = "lathe"
body["geometryDescriptor"]["latheProfile"] = {
    "points": [
        [0.22, -0.50],
        [0.37, -0.36],
        [0.49, -0.08],
        [0.45, 0.20],
        [0.31, 0.50],
    ],
    "segments": 24,
}

for side, sign in (("l", 1), ("r", -1)):
    ear = by_id[f"ear-{side}"]
    ear["primitive"] = "tapered-sweep"
    ear["transform"]["position"] = [0.19 * sign, 0.02, -0.015]
    ear["transform"]["rotation"] = [0.0, 0.0, 0.0]
    ear["transform"]["scale"] = [0.30, 0.58, 0.11]
    ear["dimensions"].update({"width": 0.30, "height": 0.58, "depth": 0.11})
    ear["geometryDescriptor"]["taperedSweep"] = {
        "stations": [
            {"position": [-0.12 * sign, 0.46, 0.0], "rx": 0.27, "rz": 0.28, "twist": 0.0},
            {"position": [0.12 * sign, 0.23, 0.0], "rx": 0.48, "rz": 0.38, "twist": 0.0},
            {"position": [0.34 * sign, -0.12, 0.0], "rx": 0.43, "rz": 0.32, "twist": 0.0},
            {"position": [0.48 * sign, -0.47, 0.0], "rx": 0.10, "rz": 0.12, "twist": 0.0},
        ],
        "radialSegments": 10,
        "capEnds": True,
    }
    ear["topologyRationale"] = "A tapered sweep carries the broad root, outward bow, downward hang, and rounded narrow tip visible in the turnaround; a straight ellipsoid produced an incorrect upright-leaf silhouette."
    inner = by_id[f"inner-ear-{side}"]
    inner["transform"]["position"] = [0.035 * sign, -0.015, 0.056]
    inner["transform"]["rotation"] = [0.0, 0.0, 0.0]


def make_material(mid, name, color, roughness, *, clearcoat=0.0, emissive=None):
    m = deep_clone(material_template)
    m.update({"id": mid, "name": name, "baseColor": color, "color": color, "notes": "Reference-matched solid stylized material; no image texture."})
    m["albedo"] = {"dominant": color, "secondary": [color], "samplingNotes": "Observed from locked concept sheet palette."}
    m["colorVariation"] = {"palette": [color], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}
    m["roughness"] = {"base": roughness, "variation": 0.02, "map": "none", "localResponse": "solid stylized response"}
    m["metalness"] = {"base": 0.0, "variation": 0.0}
    m["normal"] = {"pattern": "none", "strength": 0.0, "scale": 1.0, "space": "tangent"}
    m["bump"] = {"pattern": "none", "amplitude": 0.0, "scale": 1.0}
    m["displacement"] = {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": False}
    m["surfaceFrequencyBands"] = [
        {"id": "macro", "frequency": 1.0, "amplitude": 0.02, "role": "very subtle broad value response"},
        {"id": "meso", "frequency": 4.0, "amplitude": 0.001, "role": "effectively flat; clean stylized surface"},
        {"id": "micro", "frequency": 16.0, "amplitude": 0.001, "role": "effectively flat; no realistic fur"},
    ]
    m["clearcoat"] = {"base": clearcoat, "roughness": max(roughness * 0.5, 0.04)}
    m["localOverrides"] = []
    if mid == "fur-cream":
        m["localOverrides"].append({"id": "palette-regions", "region": "primary body/head/limbs", "baseColor": color, "roughness": roughness, "evidenceRef": "color palette and turnaround"})
    if emissive:
        m["emissive"] = {"color": emissive, "intensity": 0.35}
    return m


spec["componentTree"] = components
spec["materials"] = [
    make_material("hidden", "Hidden helper", "#000000", 1.0),
    make_material("fur-cream", "Warm cream fur", "#F3E9DE", 0.78, clearcoat=0.06),
    make_material("fur-light", "Light muzzle and tail", "#FFF7F0", 0.82, clearcoat=0.04),
    make_material("ear-pink", "Soft inner ear pink", "#ECA8AA", 0.70, clearcoat=0.08),
    make_material("eye-white", "Warm eye white", "#FFF8F0", 0.22, clearcoat=0.5),
    make_material("iris-brown", "Warm reddish-brown iris", "#9C351D", 0.16, clearcoat=0.65),
    make_material("eye-dark", "Dark pupil and rim", "#281817", 0.12, clearcoat=0.7),
    make_material("catchlight", "Eye catchlight", "#FFFFFF", 0.08, clearcoat=0.8, emissive="#FFFFFF"),
    make_material("nose-pink", "Tiny muted pink nose", "#D98286", 0.42, clearcoat=0.2),
    make_material("mouth-dark", "Neutral mouth line", "#5A2D31", 0.52),
]

spec["preSpecAssessment"]["detailInventory"] = details
spec["suitability"] = "pass"
spec["scores"] = {
    "object_isolation": 3,
    "silhouette_readability": 3,
    "depth_inference": 3,
    "primitive_decomposition": 3,
    "material_procedurality": 3,
    "occlusion_risk": 1,
    "interaction_fit": 3,
}
spec["preSpecAssessment"]["complexity"]["scores"]["componentCount"] = 3
spec["preSpecAssessment"]["complexity"]["scores"]["actionReadinessNeed"] = 3
spec["preSpecAssessment"]["unknownsToResolveBeforeImplementation"] = []
spec["silhouette"] = {
    "description": "Oversized rounded head, compact pear body, extremely long floppy ears, short limbs, rounded feet, and small rear tail.",
    "primaryAxis": "Y",
    "realHeightMeters": 1.0,
    "boundingBox": {"width": 0.72, "height": 1.0, "depth": 0.48},
    "criticalViews": ["front", "three-quarter", "right-profile", "rear"],
    "negativeSpaces": ["ear-to-cheek wedges", "arm-to-torso gaps", "foot separation"],
}
spec["featureReviewTargets"] = [
    {"id": "anatomy-proportion", "name": "Chibi rabbit proportions at 1.0 m", "tier": "critical", "passIds": ["blockout", "proportion-lock"], "minimumScore": 0.88, "mustPass": True, "componentRefs": ["head", "body", "ear-l", "ear-r", "foot-l", "foot-r"], "evidenceRefs": ["neutral turnaround"]},
    {"id": "face-landmark-placement", "name": "Large warm eyes, tiny nose, restrained mouth", "tier": "critical", "passIds": ["feature-placement"], "minimumScore": 0.86, "mustPass": True, "componentRefs": ["head", "eye-l", "eye-r", "nose", "mouth-l", "mouth-r"], "evidenceRefs": ["front and eye detail"]},
    {"id": "pose-silhouette", "name": "Neutral friendly standing silhouette", "tier": "critical", "passIds": ["blockout", "proportion-lock"], "minimumScore": 0.88, "mustPass": True, "componentRefs": ["root", "body", "head", "arm-l", "arm-r", "leg-l", "leg-r"], "evidenceRefs": ["front/side/back turnaround"]},
    {"id": "outfit-and-palette", "name": "No outfit; locked cream, pink, and brown palette", "tier": "important", "passIds": ["material-pass"], "minimumScore": 0.84, "mustPass": True, "componentRefs": ["body", "inner-ear-l", "inner-ear-r", "iris-l", "iris-r"], "evidenceRefs": ["reference palette"]},
    {"id": "floppy-ear-identity", "name": "Extremely long floppy ear silhouette", "tier": "critical", "passIds": ["blockout", "proportion-lock"], "minimumScore": 0.9, "mustPass": True, "componentRefs": ["ear-l", "ear-r", "inner-ear-l", "inner-ear-r"], "evidenceRefs": ["all turnaround views"]},
]
macro_refs = [c["id"] for c in components if c["level"] == "macro"]
meso_refs = [c["id"] for c in components if c["level"] in {"macro", "meso"}]
all_refs = [c["id"] for c in components]
spec["buildPasses"] = [
    {"id": "blockout", "goal": "Lock the 1.0 m overall silhouette, oversized head, pear body, long ears, and short limbs.", "componentRefs": macro_refs, "acceptance": ["Front, three-quarter, profile, and rear silhouettes read as the locked Bunny World hero."]},
    {"id": "structural-pass", "goal": "Establish the named runtime hierarchy, attachment overlaps, pivots, and empty hand sockets.", "componentRefs": meso_refs, "acceptance": ["No appendage floats; all requested runtime parts and both weapon sockets are queryable."]},
    {"id": "proportion-lock", "goal": "Measure head/body/ear/limb relationships against the turnaround.", "componentRefs": macro_refs, "acceptance": ["Total height is 1.0 m and the chibi rabbit proportions match within the stylized tolerance."]},
    {"id": "feature-placement", "goal": "Place layered eyes, muzzle, tiny nose, mouth, inner ears, and tail.", "componentRefs": all_refs, "acceptance": ["Facial landmarks and ear insets remain legible at gameplay distance."]},
    {"id": "form-refinement", "goal": "Refine soft organic profiles and eliminate primitive-looking joins.", "componentRefs": all_refs, "acceptance": ["Soft silhouette transitions hold from all required orbit views."]},
    {"id": "material-pass", "goal": "Apply the locked cream, pink, reddish-brown, and dark palette with stylized roughness.", "componentRefs": all_refs, "acceptance": ["Palette matches the sheet without realistic fur or image textures."]},
    {"id": "lighting-pass", "goal": "Use soft key/fill/rim lighting and a grounded contact shadow for evidence renders.", "componentRefs": ["root"], "acceptance": ["Forms remain readable without washed-out cream values."]},
    {"id": "interaction-pass", "goal": "Expose stable hierarchy metadata and empty left/right hand sockets.", "componentRefs": ["root", "hand-l", "hand-r"], "acceptance": ["Sockets exist and no weapon, rig, or animation has been added."]},
    {"id": "optimization-pass", "goal": "Keep the static model lightweight for a browser game.", "componentRefs": all_refs, "acceptance": ["Triangle and draw-call budgets are met without losing the defining silhouette."]},
]
spec["sculptPipeline"]["passOrder"] = [p["id"] for p in spec["buildPasses"]]
spec["sculptPipeline"]["currentPass"] = "blockout"
spec["sculptPipeline"]["completedPasses"] = []
spec["sculptPipeline"]["lastCompletedPass"] = ""
spec["sculptPipeline"]["blockedReason"] = "blockout requires browser-rendered comparison evidence before later passes unlock"
spec["repetitionSystems"] = [
    {"id": "paired-ears", "level": "macro", "count": 2, "elementComponentIds": ["ear-l", "ear-r"], "buildsGeometry": False, "realization": "authored-components", "placement": {"mode": "bilateral-reflection"}},
    {"id": "paired-eyes", "level": "meso", "count": 2, "elementComponentIds": ["eye-l", "eye-r"], "buildsGeometry": False, "realization": "authored-components", "placement": {"mode": "bilateral-reflection"}},
    {"id": "paired-arms", "level": "macro", "count": 2, "elementComponentIds": ["arm-l", "arm-r"], "buildsGeometry": False, "realization": "authored-components", "placement": {"mode": "bilateral-reflection"}},
    {"id": "paired-legs-feet", "level": "macro", "count": 2, "elementComponentIds": ["leg-l", "leg-r", "foot-l", "foot-r"], "buildsGeometry": False, "realization": "authored-components", "placement": {"mode": "bilateral-reflection"}},
]
spec["qualityContract"]["minimumSpecDepth"] = {
    "macroComponents": 12,
    "mesoComponents": 8,
    "microFeatureGroups": 6,
    "materialLayers": 8,
    "repetitionSystems": 4,
    "reviewViewpoints": 4,
}
spec["performanceBudget"] = {
    "qualityPriority": "gameplay-silhouette-first",
    "targetTriangles": 18000,
    "maxDrawCalls": 36,
    "textureSize": 0,
    "fpsTarget": 60,
    "optimizationPolicy": "Use low-segment smooth primitives and share materials; preserve the ears, eyes, and body proportions before reducing geometry.",
}
spec["lookDevTargets"] = {
    "style": "stylized low-poly fantasy RPG character",
    "surface": "clean, soft, rounded, no realistic fur",
    "palette": ["#F3E9DE", "#FFF7F0", "#ECA8AA", "#9C351D", "#281817"],
    "lighting": "soft key, cool ambient fill, contact shadow, neutral lavender-gray background",
}
spec["lightingFromPhoto"] = [
    {"role": "key", "type": "directional", "direction": [-3, 5, 4], "color": "#FFF4EA", "intensity": 2.2, "shadowSoftness": 0.65},
    {"role": "fill", "type": "hemisphere", "skyColor": "#DCE5FF", "groundColor": "#8B7288", "intensity": 1.25},
    {"role": "rim", "type": "directional", "direction": [3, 4, -4], "color": "#F4DFFF", "intensity": 1.1},
    {"role": "environment", "background": "#AAA8B1", "toneMapping": "ACESFilmic", "exposure": 1.05, "contactShadow": {"enabled": True, "opacity": 0.22, "softness": 0.7}, "notes": "Soft contact shadow enabled beneath feet."},
]
spec["animationAnchors"] = [
    "Stable named pivots exist for head, ears, body, arms, hands, legs, feet, and tail.",
    "weapon-socket-l and weapon-socket-r are empty future attachment transforms.",
    "No bones, skin weights, clips, or animation are emitted in this static reconstruction.",
]
spec["rig"] = {
    "deferred": True,
    "reason": "User explicitly requested logical future hierarchy and sockets but no rig or animation in this pass.",
}
spec["assumptions"] = [
    "One Blender/Three.js world unit equals one meter for authored dimensions.",
    "The turnaround is illustration-consistent but not a manufacturing orthographic drawing.",
    "Ears use flattened convex volumes; fur tufts are sparse silhouette accents only.",
]
spec["risks"] = [
    "Primitive joins can read as segmented if overlap or lighting is insufficient.",
    "Gameplay readability depends on preserving eye contrast and ear length after optimization.",
    "The generated baseline factory will be refined in code to create curved ear profiles and clean facial layering.",
]

SPEC_PATH.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
print(SPEC_PATH)
