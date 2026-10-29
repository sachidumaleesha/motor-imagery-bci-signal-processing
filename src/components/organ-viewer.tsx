"use client";

import { cn } from "cn";
import {
  CircleAlertIcon,
  InfoIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
} from "lucide-react";
import * as React from "react";
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  type Group,
  HemisphereLight,
  type Intersection,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Spherical,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type OrganStructure = {
  /** Mesh name, or `userData.structureId`, of the structure in the GLB. */
  id: string;
  label: string;
  /** Interface grouping, as shown in the explorer's anatomy panel. */
  group: string;
  color: string;
  description?: string;
};

export type OrganView = {
  name: string;
  /**
   * Camera direction from the framing centre in model space: +x is the
   * patient's left, +y superior and +z anterior.
   */
  direction: readonly [number, number, number];
  /** Frame only these structures. Defaults to the whole model. */
  structureIds?: readonly string[];
};

export type OrganModel = {
  name: string;
  /** GLB URL: a commit-pinned file in the organ's explorer repository, or one served by organui.com. */
  src: string;
  /** Expected size in bytes, for progress when the server sends no length. */
  bytes?: number;
  structures: readonly OrganStructure[];
  views: readonly OrganView[];
  defaultView: string;
  /** Structures the explorer hides on first load. */
  hiddenIds?: readonly string[];
  /** Structures drawn see-through, so the ones inside them show, such as fat over a gland. */
  translucentIds?: readonly string[];
  attribution: {
    credit: string;
    license: string;
    licenseUrl: string;
    source: string;
  };
};

export type OrganViewerHandle = {
  setView: (name: string) => void;
  zoom: (factor: number) => void;
  rotate: (azimuth: number, polar?: number) => void;
  reset: () => void;
};

export type OrganViewerProps = Omit<React.ComponentProps<"div">, "ref"> & {
  /** The model: its GLB, structures, named views and credit. */
  model: OrganModel;
  /** Overrides `model.src`, for example to serve the GLB yourself. */
  src?: string;
  /** The selected structure id, or null. */
  selectedId?: string | null;
  /** Called with the structure a reader selects. */
  onSelectionChange?: (id: string) => void;
  /** Missing IDs are visible, matching the anatomy tree's contract. */
  visibility?: Readonly<Record<string, boolean>>;
  /** The named view shown first. */
  defaultView?: string;
  /** Called with the view name, or null once the camera is rotated freely. */
  onViewChange?: (view: string | null) => void;
  /** Shows the view menu, zoom and reset buttons. Defaults to true. */
  controls?: boolean;
  /** Shows a button that opens the model credit and licence link. Keep it unless you credit the model elsewhere. */
  attribution?: boolean;
  /** The accessible name of the viewer. */
  label?: string;
  /** Sets views, zooms, rotates and resets from your own controls. */
  ref?: React.Ref<OrganViewerHandle>;
};

/** Rows for the OrganUI anatomy tree: non-selectable groups of coloured leaves. */
export function organAnatomyNodes(model: OrganModel) {
  const groups = [...new Set(model.structures.map(({ group }) => group))];
  return groups.map((group) => ({
    id: `group-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    label: group,
    selectable: false,
    children: model.structures
      .filter((structure) => structure.group === group)
      .map(({ id, label, color }) => ({ id, label, color })),
  }));
}

/** The explorer's initial visibility, as an anatomy tree visibility map. */
export function organDefaultVisibility(
  model: OrganModel,
): Record<string, boolean> {
  return Object.fromEntries((model.hiddenIds ?? []).map((id) => [id, false]));
}

// Shared with every OrganUI explorer so named views fill the stage by the same
// rule whatever the organ's shape.
const FRAME_FILL = 0.8;
const STAGE_TONE = new Color("#e4e3dc");
// How long a recolour fades, in milliseconds.
const FADE_MS = 450;
// A model without the item's structures is the wrong file, not a network
// problem, so its message does not suggest checking the connection.
const MISMATCH = "The model does not contain the expected structures.";

// Faded parts blend towards the stage, so its tone follows the theme: the
// theme's --muted, resolved through a canvas because three.js cannot parse
// oklch(), and read again when the theme changes. Returns a count that
// changes each time, for effects that repaint.
function useStageTone(host: React.RefObject<HTMLElement | null>) {
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    const read = () => {
      const muted = host.current
        ? getComputedStyle(host.current).getPropertyValue("--muted").trim()
        : "";
      const context = muted
        ? document
            .createElement("canvas")
            .getContext("2d", { willReadFrequently: true })
        : null;
      if (!context) return;
      context.fillStyle = muted;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      STAGE_TONE.setStyle(`rgb(${r}, ${g}, ${b})`);
      setVersion((count) => count + 1);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", read);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", read);
    };
  }, [host]);
  return version;
}

function surfacePoints(meshes: Mesh[], stride = 16) {
  const points: Vector3[] = [];
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += stride)
      points.push(
        new Vector3()
          .fromBufferAttribute(position, i)
          .applyMatrix4(mesh.matrixWorld),
      );
  }
  return points;
}

// Distance along `direction` at which every sampled point sits inside
// FRAME_FILL of the frustum.
function fitDistance(
  points: Vector3[],
  center: Vector3,
  direction: Vector3,
  fov: number,
  aspect: number,
) {
  const forward = direction.clone().normalize();
  const right = new Vector3(0, 1, 0).cross(forward);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = forward.clone().cross(right).normalize();
  const tanV = Math.tan((fov * Math.PI) / 360) * FRAME_FILL;
  const tanH = tanV * aspect;
  const offset = new Vector3();
  let distance = 0;
  for (const point of points) {
    offset.subVectors(point, center);
    distance = Math.max(
      distance,
      offset.dot(forward) +
        Math.max(
          Math.abs(offset.dot(right)) / tanH,
          Math.abs(offset.dot(up)) / tanV,
        ),
    );
  }
  return distance;
}

// Ghosts stay pickable when nothing solid is behind them, but solid anatomy
// seen through a translucent shell wins the click.
function pickVisibleMesh(hits: Intersection<Object3D>[]) {
  const meshes = hits
    .map(({ object }) => object)
    .filter((object): object is Mesh => {
      if (!(object instanceof Mesh)) return false;
      for (let parent: Object3D | null = object; parent; parent = parent.parent)
        if (!parent.visible) return false;
      return true;
    });
  return (
    meshes.find((mesh) => {
      const material = mesh.material as Material;
      return !material.transparent || material.opacity >= 1;
    }) ?? meshes[0]
  );
}

// A structure may be a mesh, or a node whose meshes are its children.
function structureId(object: Object3D, known: ReadonlySet<string>) {
  for (let node: Object3D | null = object; node; node = node.parent) {
    const id: string = node.userData.structureId || node.name;
    if (known.has(id)) return id;
  }
}

function dispose(model: Group) {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material: Material) => {
      material.dispose();
    });
  });
}

async function loadModel(
  src: string,
  expected: number | undefined,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
) {
  const response = await fetch(src, { signal });
  if (!response.ok)
    throw new Error(`The model request returned HTTP ${response.status}.`);
  const total = Number(response.headers.get("content-length")) || expected || 0;
  const reader = response.body?.getReader();
  let data: ArrayBuffer;
  if (reader) {
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total) onProgress(Math.min(95, Math.round((received / total) * 95)));
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    data = bytes.buffer;
  } else data = await response.arrayBuffer();
  if (
    data.byteLength < 12 ||
    new DataView(data).getUint32(0, true) !== 0x46546c67
  )
    throw new Error("The model file is missing or is not a valid GLB.");
  return (await new GLTFLoader().parseAsync(data, "")).scene;
}

type Engine = OrganViewerHandle & {
  paint: (
    selectedId: string | null,
    visibility: Readonly<Record<string, boolean>>,
  ) => void;
};

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function OrganViewer({
  model,
  src = model.src,
  selectedId = null,
  onSelectionChange,
  visibility,
  defaultView = model.defaultView,
  onViewChange,
  controls = true,
  attribution = true,
  label = `Interactive ${model.name.toLowerCase()} model`,
  className,
  ref,
  ...props
}: OrganViewerProps) {
  const host = React.useRef<HTMLDivElement>(null);
  const tone = useStageTone(host);
  const [attempt, setAttempt] = React.useState(0);
  // Load results are keyed by request so a new src or retry starts clean
  // without resetting state inside the effect.
  const request = `${attempt}:${src}`;
  const [result, setResult] = React.useState<{
    request: string;
    scene?: Group;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = React.useState({ request, progress: 0 });
  const scene = result?.request === request ? (result.scene ?? null) : null;
  const error = result?.request === request ? (result.error ?? null) : null;
  const progress = loading.request === request ? loading.progress : 0;
  const [graphicsFailed, setGraphicsFailed] = React.useState(false);
  const [engine, setEngine] = React.useState<Engine | null>(null);
  const [view, setView] = React.useState<string | null>(defaultView);
  const [interacted, setInteracted] = React.useState(false);
  const latest = React.useRef({
    model,
    defaultView,
    onSelectionChange,
    onViewChange,
  });
  React.useLayoutEffect(() => {
    latest.current = { model, defaultView, onSelectionChange, onViewChange };
  });
  const instructions = React.useId();

  const shown = React.useMemo(
    () => visibility ?? organDefaultVisibility(model),
    [visibility, model],
  );
  const viewRef = React.useRef(view);
  const changeView = React.useCallback((next: string | null) => {
    if (viewRef.current === next) return;
    viewRef.current = next;
    setView(next);
    latest.current.onViewChange?.(next);
  }, []);

  React.useEffect(() => {
    const abort = new AbortController();
    let loaded: Group | null = null;
    const timeout = setTimeout(() => abort.abort("timeout"), 60_000);
    loadModel(src, latest.current.model.bytes, abort.signal, (percent) =>
      setLoading({ request, progress: percent }),
    )
      .then((group) => {
        loaded = group;
        if (abort.signal.aborted) return dispose(group);
        const known = new Set(
          latest.current.model.structures.map(({ id }) => id),
        );
        const found = new Set<string>();
        group.traverse((object) => {
          const id = object instanceof Mesh && structureId(object, known);
          if (id) found.add(id);
        });
        const missing = [...known].filter((id) => !found.has(id));
        if (missing.length) throw new Error(MISMATCH);
        setResult({ request, scene: group });
      })
      .catch((reason: unknown) => {
        if (abort.signal.aborted && abort.signal.reason !== "timeout") return;
        setResult({
          request,
          error:
            abort.signal.reason === "timeout"
              ? "The download timed out."
              : reason instanceof Error
                ? reason.message
                : "The model could not be decoded.",
        });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      abort.abort("unmount");
      clearTimeout(timeout);
      if (loaded) dispose(loaded);
    };
  }, [src, request]);

  React.useEffect(() => {
    const container = host.current;
    if (!scene || !container || graphicsFailed) return;
    const structures = new Map(
      latest.current.model.structures.map((structure) => [
        structure.id,
        structure,
      ]),
    );
    const meshes = new Map<string, Mesh[]>();
    const known = new Set(structures.keys());
    scene.traverse((object) => {
      const id = object instanceof Mesh && structureId(object, known);
      if (!id) return;
      // Materials may be shared in the GLB, but emphasis is per structure.
      const source = object.material as MeshStandardMaterial;
      object.material =
        source instanceof MeshStandardMaterial
          ? source.clone()
          : new MeshStandardMaterial();
      meshes.set(id, [...(meshes.get(id) ?? []), object]);
    });

    const canvas = document.createElement("canvas");
    canvas.className = "block size-full touch-none outline-none";
    canvas.setAttribute("aria-hidden", "true");
    container.prepend(canvas);
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      canvas.remove();
      // WebGL is an external system; its failure is reported once per attempt.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGraphicsFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const stage = new Scene();
    stage.add(new AmbientLight("#ffffff", 0.8));
    stage.add(new HemisphereLight("#fffcf3", "#a49b8f", 1.6));
    const lights: [[number, number, number], number, string][] = [
      [[-4, 6, 6], 2.6, "#fff5e6"],
      [[5, 1, -4], 1.8, "#e1edff"],
      [[-3, -3, 0], 0.45, "#ffffff"],
    ];
    for (const [position, intensity, color] of lights) {
      const light = new DirectionalLight(color, intensity);
      light.position.set(position[0], position[1], position[2]);
      stage.add(light);
    }
    stage.add(scene);
    const camera = new PerspectiveCamera(34, 1, 0.05, 100);
    const orbit = new OrbitControls(camera, canvas);
    orbit.enablePan = false;
    orbit.rotateSpeed = 0.65;
    orbit.zoomSpeed = 0.8;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => (orbit.enableDamping = !motion.matches);
    applyMotion();
    motion.addEventListener("change", applyMotion);

    const allMeshes = [...meshes.values()].flat();
    const points = surfacePoints(allMeshes);
    const center = new Box3().setFromPoints(points).getCenter(new Vector3());
    const radius =
      new Box3().setFromObject(scene).getSize(new Vector3()).length() / 2;
    const framing = new Map(
      latest.current.model.views.map((entry) => {
        const subset = entry.structureIds?.flatMap(
          (id) => meshes.get(id) ?? [],
        );
        const framed = subset?.length ? surfacePoints(subset) : points;
        const target = subset?.length
          ? new Box3().setFromPoints(framed).getCenter(new Vector3())
          : center;
        return [entry.name, { entry, framed, target }];
      }),
    );
    // Views of a few structures, such as the head of a whole-body model, may
    // come closer than the whole model allows.
    const closest = Math.min(
      radius,
      ...[...framing.values()].map(
        ({ framed }) =>
          new Box3().setFromPoints(framed).getSize(new Vector3()).length() / 2,
      ),
    );
    camera.near = closest / 100;
    camera.far = radius * 20;
    orbit.minDistance = closest * 1.25;
    orbit.maxDistance = radius * 6;

    // Colours fading from one paint to the next, such as a condition moving to
    // its next stage.
    const fades = new Map<
      MeshStandardMaterial,
      { from: Color; to: Color; start: number }
    >();
    let dirty = true;
    const render = () => (dirty = true);
    let frame = 0;
    const tick = (now: number) => {
      for (const [material, fade] of fades) {
        const t = Math.min(1, (now - fade.start) / FADE_MS);
        material.color.lerpColors(fade.from, fade.to, t * (2 - t));
        if (t === 1) fades.delete(material);
        dirty = true;
      }
      if (orbit.update() || dirty) {
        renderer.render(stage, camera);
        dirty = false;
      }
      frame = requestAnimationFrame(tick);
    };

    let current: string | null = latest.current.defaultView;
    const preset = (name: string) => {
      const target = framing.get(name) ?? framing.values().next().value;
      if (!target) return;
      orbit.reset();
      const direction = new Vector3(...target.entry.direction).normalize();
      const distance = Math.min(
        orbit.maxDistance,
        Math.max(
          orbit.minDistance,
          fitDistance(
            target.framed,
            target.target,
            direction,
            camera.fov,
            camera.aspect,
          ),
        ),
      );
      orbit.target.copy(target.target);
      camera.position
        .copy(direction)
        .multiplyScalar(distance)
        .add(target.target);
      camera.lookAt(target.target);
      orbit.update();
      current = target.entry.name;
      changeView(current);
      render();
    };

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      const changed = Math.abs(aspect - camera.aspect) > 1e-6;
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      // A named view is refitted; a free camera keeps its target and distance.
      if (changed && current) preset(current);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    camera.updateProjectionMatrix();
    preset(latest.current.defaultView);

    let interacting = false;
    const lastRotation = camera.quaternion.clone();
    const onStart = () => (interacting = true);
    const onEnd = () => (interacting = false);
    const onChange = () => {
      if (interacting) {
        setInteracted(true);
        if (1 - Math.abs(lastRotation.dot(camera.quaternion)) > 1e-10) {
          current = null;
          changeView(null);
        }
      }
      lastRotation.copy(camera.quaternion);
      render();
    };
    orbit.addEventListener("start", onStart);
    orbit.addEventListener("end", onEnd);
    orbit.addEventListener("change", onChange);

    const raycaster = new Raycaster();
    const down = new Vector2();
    const onPointerDown = (event: PointerEvent) =>
      down.set(event.clientX, event.clientY);
    const onPointerUp = (event: PointerEvent) => {
      if (down.distanceTo(new Vector2(event.clientX, event.clientY)) > 4)
        return;
      const bounds = canvas.getBoundingClientRect();
      raycaster.setFromCamera(
        new Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
        ),
        camera,
      );
      const mesh = pickVisibleMesh(
        raycaster.intersectObjects(allMeshes, false),
      );
      const id = mesh && structureId(mesh, known);
      if (id) latest.current.onSelectionChange?.(id);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setGraphicsFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    const ghosts = new Map<string, Color>();
    setEngine({
      paint(selected, shown) {
        // Colours come from the current model, so a model that recolours the
        // same structures, such as a condition stage, repaints without a reload.
        const colors = new Map(
          latest.current.model.structures.map(({ id, color }) => [id, color]),
        );
        const translucent = new Set(latest.current.model.translucentIds);
        for (const [id, list] of meshes) {
          const structure = structures.get(id);
          if (!structure) continue;
          const color = colors.get(id) ?? structure.color;
          const state = !selected
            ? "normal"
            : id === selected
              ? "selected"
              : "ghosted";
          const key = `${color}/${STAGE_TONE.getHexString()}`;
          let ghost = ghosts.get(key);
          if (!ghost) {
            ghost = new Color(color).lerp(STAGE_TONE, 0.5);
            ghosts.set(key, ghost);
          }
          for (const mesh of list) {
            const material = mesh.material as MeshStandardMaterial;
            mesh.visible = shown[id] !== false;
            const target = state === "ghosted" ? ghost : new Color(color);
            // A structure recoloured in the same state, such as at a condition's
            // next stage, fades to its new colour. A first paint, a selection
            // change and reduced motion apply at once.
            const fade =
              !motion.matches &&
              material.userData.state === state &&
              !material.color.equals(target);
            if (!fade) {
              fades.delete(material);
              material.color.copy(target);
            } else if (!fades.get(material)?.to.equals(target)) {
              fades.set(material, {
                from: material.color.clone(),
                to: target.clone(),
                start: performance.now(),
              });
            }
            material.userData.state = state;
            material.emissive.set(state === "selected" ? color : "#000000");
            material.emissiveIntensity = state === "selected" ? 0.35 : 0;
            // A translucent structure stays see-through until it is selected.
            const clear = state === "normal" && translucent.has(id) ? 0.3 : 1;
            material.transparent = state === "ghosted" || clear < 1;
            material.opacity = state === "ghosted" ? 0.22 : clear;
            material.depthWrite = state !== "ghosted" && clear === 1;
            material.roughness = 0.58;
            // glTF defaults to fully metallic when a file omits the factor.
            material.metalness = 0;
            material.needsUpdate = true;
          }
        }
        render();
      },
      setView: preset,
      reset: () => preset(latest.current.defaultView),
      zoom(factor) {
        const offset = camera.position.clone().sub(orbit.target);
        offset.setLength(
          Math.min(
            orbit.maxDistance,
            Math.max(orbit.minDistance, offset.length() * factor),
          ),
        );
        camera.position.copy(orbit.target).add(offset);
        orbit.update();
        setInteracted(true);
        render();
      },
      rotate(azimuth, polar = 0) {
        const spherical = new Spherical().setFromVector3(
          camera.position.clone().sub(orbit.target),
        );
        spherical.theta += azimuth;
        spherical.phi += polar;
        spherical.makeSafe();
        camera.position
          .copy(orbit.target)
          .add(new Vector3().setFromSpherical(spherical));
        orbit.update();
        current = null;
        changeView(null);
        setInteracted(true);
        render();
      },
    });
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      setEngine(null);
      observer.disconnect();
      motion.removeEventListener("change", applyMotion);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      orbit.dispose();
      stage.remove(scene);
      renderer.dispose();
      canvas.remove();
    };
  }, [scene, graphicsFailed, changeView]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: theme tone and model updates require repainting the existing engine.
  React.useEffect(() => {
    engine?.paint(selectedId, shown);
  }, [engine, selectedId, shown, tone, model]);

  React.useImperativeHandle(
    ref,
    () => ({
      setView: (name) => engine?.setView(name),
      zoom: (factor) => engine?.zoom(factor),
      rotate: (azimuth, polar) => engine?.rotate(azimuth, polar),
      reset: () => engine?.reset(),
    }),
    [engine],
  );

  const retry = () => {
    setGraphicsFailed(false);
    setAttempt((n) => n + 1);
  };
  const message = error
    ? {
        title: `The ${model.name.toLowerCase()} model couldn’t load`,
        text:
          error === MISMATCH
            ? `${error} Check that src points to this model's file.`
            : `${error} Check your connection and try again.`,
      }
    : graphicsFailed
      ? {
          title: "3D view unavailable",
          text: "WebGL could not start or its connection was interrupted. Try again, or use a browser with hardware acceleration enabled.",
        }
      : null;

  return (
    <div
      data-slot="organ-viewer"
      data-selected-id={selectedId ?? undefined}
      {...props}
      ref={host}
      role="application"
      aria-label={label}
      aria-describedby={instructions}
      className={cn(
        "relative h-[28rem] w-full overflow-hidden rounded-xl border bg-muted/30 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      <p id={instructions} className="sr-only">
        Drag to rotate, scroll or pinch to zoom, and click a structure to select
        it. The named view and zoom buttons are keyboard accessible.
      </p>
      {message ? (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <Alert className="max-w-sm">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{message.title}</AlertTitle>
            <AlertDescription>
              <p>{message.text}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={retry}
                className="mt-3 text-foreground"
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : !scene ? (
        <output className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
          <Progress
            value={progress}
            aria-label={`Loading ${model.name.toLowerCase()} model`}
            className="w-40"
          />
          <p className="text-muted-foreground">{progress}% · Loading anatomy</p>
        </output>
      ) : null}
      {engine && controls && (
        <TooltipProvider>
          <div
            role="toolbar"
            aria-label="View controls"
            className="absolute top-2 right-2 flex items-center gap-0.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur"
          >
            {/* An empty value shows the placeholder: a view set by dragging. */}
            <Select
              value={view ?? ""}
              onValueChange={(next) => {
                if (next) engine.setView(next);
              }}
            >
              <SelectTrigger aria-label="View" className="border-transparent">
                <SelectValue placeholder="Custom view" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {model.views.map(({ name }) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <ToolbarButton label="Zoom in" onClick={() => engine.zoom(0.85)}>
              <PlusIcon aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton label="Zoom out" onClick={() => engine.zoom(1.18)}>
              <MinusIcon aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton label="Reset view" onClick={() => engine.reset()}>
              <RotateCcwIcon aria-hidden="true" />
            </ToolbarButton>
          </div>
        </TooltipProvider>
      )}
      {engine && !interacted && (
        <p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-muted-foreground"
        >
          Drag to rotate · Scroll or pinch to zoom
        </p>
      )}
      {attribution && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Model credit"
              className="absolute right-2 bottom-2 text-muted-foreground"
            >
              <InfoIcon aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            aria-label="Model credit"
            className="w-64 text-xs"
          >
            <a
              href={model.attribution.source}
              className="underline-offset-2 hover:underline"
            >
              {model.attribution.credit}
            </a>
            <a
              href={model.attribution.licenseUrl}
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              {model.attribution.license}
            </a>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
