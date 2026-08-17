// `import type` rather than a plain import because it is only ever used as one (see MaskMeshRefs
// below), and spelling that out has a payoff beyond tidiness: it makes this module free of runtime
// imports entirely, so the peak height field's own math can be loaded and unit-tested directly under
// `node --experimental-strip-types` with no bundler or module-resolution setup (see peak-field.test.ts).
import type { MaskCurve_V1_0, PeakBlackPoint_V1_0 } from "./workspace.server";
import type { PeakShape } from "./canvas-media/peak-shape";

/** Default width/height of the light source's bright core, in on-screen (CSS) pixels -- converted to buffer pixels per frame. Adjustable via Maskbar's light source size slider. */
export const CAPTURE_SIZE_CSS_PX_DEFAULT = 150;

/** Default brightness of the light source's core, 0-1 -- 1 mixes the epicenter fully to white. Adjustable via Maskbar's light source intensity slider. */
export const CAPTURE_INTENSITY_DEFAULT = 0.05;

/** Default distance, in on-screen (CSS) pixels, over which the darkening ramps up beyond the core -- independent of canvas size. Adjustable via Maskbar's light source falloff slider. */
export const CAPTURE_FALLOFF_CSS_PX_DEFAULT = 350;

/** Default strength of the darkening at the far edge of the spread, 0-1 -- 1 drives it fully to black. Adjustable via Maskbar's light source darkness slider. */
export const CAPTURE_DARKNESS_DEFAULT = 0.2;

/** How far past its own core a freshly drawn capture reaches, as a multiple of its drawn diameter
 * -- the seed for Capture_V1_0.falloff at creation (see captureMeshSection, workspace.client.tsx).
 *
 * A capture is a standing light on the mesh (see resolveRestingLightSources, project-mask-item.tsx),
 * and the shader gates all of a light's relief on reach = 1 - smoothstep(radius, radius + falloff,
 * dist) -- so a capture whose falloff is 0 casts *nothing* past its own rim, no matter how bright it
 * is. That was the old creation default, which made a freshly dropped capture invisible on any peak
 * it wasn't literally sitting on top of.
 *
 * Derived from the two preview defaults above rather than picked independently, so a dropped capture
 * reaches like the cursor light it's modelled on: the cursor spreads CAPTURE_FALLOFF_CSS_PX_DEFAULT
 * past a core of CAPTURE_SIZE_CSS_PX_DEFAULT, and this is that same ratio. Scaling it off the drawn
 * diameter (rather than copying the cursor's own px distance) is what makes a bigger capture reach
 * proportionally further, and keeps the whole computation in mesh space -- `size` is already mesh
 * space, so no canvas-scale conversion enters into it. Seeded once, at creation: from then on the
 * falloff is the Lightsourcebar slider's to own, so a later resize moves the core without yanking
 * the reach along with it. */
export const CAPTURE_FALLOFF_TO_SIZE_RATIO = CAPTURE_FALLOFF_CSS_PX_DEFAULT / CAPTURE_SIZE_CSS_PX_DEFAULT;

/** Default opacity, 0-1, of each triangle's own edge-stroke wireframe overlay (0 invisible, 1
 * fully visible; see edge/withEdge in the fragment shader below) -- the mesh's own fill is always
 * the source photo (see base below), this only ever controls the wireframe drawn on
 * top of it. Persisted server-side as ProjectMask_V1_0.texture (see projects.server.ts),
 * per-placement rather than client-only state; Maskbar's texture slider edits it in place via
 * updateProject, the same way it edits light_source_*. */
export const TEXTURE_MIX_DEFAULT = 0.5;

/** How many simultaneous light sources one mask's draw call supports -- must match the fragment
 * shader's own MAX_LIGHT_SOURCES #define below. drawMaskMesh silently drops anything past this
 * many entries in DrawMaskMeshOptions.lightSources. */
export const MAX_MASK_LIGHT_SOURCES = 8;

/** How many topology peaks one mask's draw call supports -- must match the shared peak kernel's own
 * MAX_MASK_PEAKS #define below, and mirrors MAX_MASK_LIGHT_SOURCES' role exactly. drawMaskMesh
 * silently drops anything past this many, highest |elevation| first, so the peaks that actually
 * carry the mesh's relief are the ones that survive the cut.
 *
 * The cost is uniform registers: a vec4[16] plus a float[16] is 32 of them per stage on a driver
 * that gives each array element its own (which is most), on top of the ~40 the light arrays already
 * spend in the fragment stage. Comfortable on any desktop driver and fine on mobile, but if a link
 * ever fails for want of them, halving this constant is the whole fix -- the #define is spliced
 * from it and every loop below is bounded by it. */
export const MAX_MASK_PEAKS = 16;

/** Default elevation a freshly drawn topology peak is created at -- Maskbar's own elevation slider
 * both seeds this (it's the value read at the instant a new circle-drag commits, see
 * workspace.client.tsx's createTopologyPeak) and edits it afterwards once a peak is active,
 * mirroring TEXTURE_MIX_DEFAULT's dual role for texture.
 *
 * Deliberately not 0: elevation is the amplitude of a real height field now (see PEAK_FIELD_GLSL
 * below), so a peak at 0 has no dome, no gradient, and therefore no relief at all -- drawing a
 * circle would appear to do nothing. This is the elevation at which a freshly drawn peak reads as
 * an obvious but unexaggerated bump. */
export const PEAK_ELEVATION_DEFAULT = 80;

/** Bound Lightsourcebar's elevation slider allows in *either* direction -- both while staging the
 * elevation the next circle-drag will create a peak at (see stagedPeak, ui-state.ts) and once a
 * peak is active. Symmetric because elevation is signed: a negative peak is a dent/crater, the same
 * dome inverted, and there is no reason to allow less of one than the other.
 *
 * In mesh-local position-space units, as the height field's own amplitude (see PEAK_FIELD_GLSL).
 * Nothing clamps a peak below this beyond it -- a small radius with a large elevation is a
 * deliberately sharp spike, not an error. What *is* structurally bounded is the in-plane swell it
 * produces, to 0.385 * MASK_PEAK_SWELL * |elevation| pixels regardless of radius (see peakSwell),
 * so this ceiling has a predictable worst case rather than a radius-dependent one. */
export const MAX_MASK_PEAK_ELEVATION = 300;

/** Bounds Maskbar's falloff slider allows for the exponent of a peak's radial profile
 * k(u) = (1 - u^2)^falloff. PEAK_FALLOFF_DEFAULT (2.0, defined beside Peak_V1_0 in
 * workspace.server.ts because it's the *schema* default the wire backfills) sits inside them and is
 * the smooth dome whose slope vanishes at both the epicenter and the rim.
 *
 * 1.0 is the paraboloid 1 - u^2, whose rim slope is -2: that leaves a visible crease ring where the
 * peak meets flat mesh, which is a legitimate look to author rather than a bug to prevent, so it's
 * the floor rather than being disallowed. 6.0 is a needle. Below 1.0 the profile's derivative
 * branch involves pow() of a near-zero base to a negative exponent, which is why the floor isn't
 * simply 0 -- see peakProfile's own guard, which stays defensive anyway for documents stored before
 * these bounds existed. */
export const MIN_MASK_PEAK_FALLOFF = 1.0;
export const MAX_MASK_PEAK_FALLOFF = 6.0;

/** Smallest radius the UI will author for a peak. A radius of 0 is degenerate rather than merely
 * small -- the height field divides by it (u = dist / radius) -- and it is no longer overloaded as
 * the delete signal either (see MaskPeakUpdateRequest_V1_0.remove), so this is what both Maskbar's
 * radius slider floors at and what an accidentally tiny circle-drag gets clamped up to. */
export const MIN_MASK_PEAK_RADIUS_PX = 8;

/** How many mesh pixels of in-plane "swell" one unit of elevation buys -- the single knob for the
 * deliberately-authored parallax a peak displaces geometry by (see peakSwell below). The bound it
 * implies is |displacement| <= 0.385 * this * |elevation| px, independent of the peak's radius.
 *
 * Much smaller than the ~3.5 that would reproduce the old warp's feel, for two reasons. The illusion
 * of a bump is now carried mostly by the shading (a real perturbed-normal lighting term, see the
 * fragment stage), so the geometric component can afford to be the subtler of the two rather than
 * doing all the work. And more concretely: MASK_PEAK_SWELL_LIMIT starts clamping once
 * this * |elevation| > 0.9 * radius, and a value large enough to make that condition true for
 * ordinary peaks would turn the safety guard into the thing deciding the swell's shape (a cone
 * rather than a dome). At 0.5 a default-elevation peak stays unclamped for any radius above ~45px,
 * so the guard only engages for genuine needles -- see MASK_PEAK_SWELL_LIMIT. */
export const MASK_PEAK_SWELL = 0.5;

/** Hard ceiling on one peak's own swell coefficient, as a fraction of a point's distance to that
 * peak's epicenter. Below 1.0, a single peak can never pull a point past its own center and fold the
 * mesh inside out -- the coefficient reaches MASK_PEAK_SWELL * |elevation| / radius as u -> 0, which
 * a large crater on a small radius would otherwise blow straight through. Two peaks stacked on the
 * same spot can still fold each other; that's the same "deliberately sharp, potentially
 * self-overlapping" tradeoff MAX_MASK_PEAK_ELEVATION already documents.
 *
 * This is meant to be a guard, not a shaper, and the difference is observable: while it's binding,
 * |displacement| grows linearly in the distance from the epicenter (a cone) instead of following the
 * profile's own u*k(u) (a dome), and the closed-form bound below still holds but stops being tight.
 * It binds over the inner region where MASK_PEAK_SWELL * |elevation| * k(u) > 0.9 * radius, i.e.
 * only for peaks taller than roughly twice their own radius. If you raise MASK_PEAK_SWELL, check
 * that condition against a typical peak before assuming the swell still looks like the field. */
export const MASK_PEAK_SWELL_LIMIT = 0.9;

/** Range the shape table's slope channel is encoded across, as +/- this many units of
 * d(rho)/d(theta) (see encodePeakShapeTexture and peakShapeAt).
 *
 * A slope only exists for a shaped peak: rho is identically 1 for a circle, so rho' is identically 0
 * and none of this is reachable. The magnitudes that actually occur are set by how sharply a
 * silhouette's outline turns -- an axis-aligned square peaks at 1.0 right at its corners, and a
 * five-pointed star with notches at 0.4 of its tips reaches about 3. 8 leaves headroom over both
 * while keeping the 16-bit quantization at 2.4e-4, which is far below anything the lighting can show.
 *
 * A silhouette needlier than that has its slope clamped rather than wrapped, so the very tip of a
 * spike lights slightly flatter than it geometrically should. That is a graceful, local failure, and
 * the alternative -- a wider range for every shape -- would spend precision everywhere to buy it. */
export const PEAK_SHAPE_SLOPE_RANGE = 8.0;

/** Floor on a shape's normalized reach, applied when the table is read (see peakShapeAt).
 *
 * rho is normalized so its maximum is exactly 1, so this says "no direction reaches less than 5% of
 * the way the furthest one does". That is not an arbitrary safety margin -- a 20:1 spike is already
 * narrower than the 128-sample table can describe (its tip falls between texels), so below this the
 * representation has given up regardless and the floor only decides how it gives up.
 *
 * It also keeps the field's arithmetic inside mediump. The gradient's tangential term divides by
 * rho SQUARED (see peakField), so an unfloored rho near zero produces coefficients in the millions --
 * which overflows to inf, and the normalize() the fragment stage builds its lighting normal with
 * turns inf into NaN. The failure mode is black fragments scattered over the peak, with nothing in
 * the compile log about it. */
export const PEAK_SHAPE_MIN_RHO = 0.05;

/** Ceiling on the height field's own gradient, in dimensionless slope (see peakField).
 *
 * A guard, not a shaper -- the same status MASK_PEAK_SWELL_LIMIT has, and the same reason to keep it
 * far from where anything real lives. An ordinary peak's gradient runs around 0.1; 32 is an 88-degree
 * wall, indistinguishable from any larger value once normalize() has turned it into a unit normal.
 * So this never binds on a shape anyone authors, and exists purely so that the pathological
 * combination (a needle-thin lobe on a tiny radius at maximum elevation) saturates instead of
 * overflowing mediump. Paired with PEAK_SHAPE_MIN_RHO, it keeps every intermediate in that
 * calculation under ~20k, which is inside the fp16 range mediump is realistically implemented as. */
export const PEAK_GRADIENT_LIMIT = 32.0;

/** Profile height, as a fraction of a peak's own elevation, below which that peak is treated as having
 * no relief left -- which is where its black point stops being at full strength and starts fading out
 * (see PEAK_BLACK_POINT_HALO_MAX for the band it fades across).
 *
 * This exists because a peak's *radius* and its *relief* are not the same boundary, and the gap
 * between them grows with falloff. k(u) = (1 - u^2)^f collapses faster the higher f is, so at
 * MAX_MASK_PEAK_FALLOFF a peak is a needle whose height is gone by u ~ 0.76 and whose shading is gone
 * by u ~ 0.85, leaving the outer 27% of its own footprint as flat, unelevated mesh. Anchoring the
 * black point to the radius therefore tinted a broad flat annulus that has no relief to floor,
 * rendering it as a visibly unshaded "base" ringing the peak -- the region had always been flat, but
 * it took a tint to make it legible. Anchoring to where the relief actually ends instead means the
 * colour follows the peak that is visible rather than the disc that was authored.
 *
 * A constant threshold on k is a good stand-in for "where the relief ends" and a cheap one: solving
 * k(u) = this for u is a single pow. It tracks the measured extent of the bump shading to within a few
 * percent of the radius across the whole falloff range. It is an approximation in one specific way --
 * it takes no account of elevation, and a taller peak's relief does reach marginally further -- but
 * measured across the full elevation and radius ranges that spread is only 0.071 in u, and the
 * threshold sits at the outer end of it, so the error falls on the side of covering slightly too much
 * rather than leaving relief unlifted.
 *
 * 1e-3 rather than something larger because k is what collapses; near the edge it falls so steeply
 * that an order of magnitude either way moves the boundary by a few percent of the radius at most. */
export const PEAK_BLACK_POINT_RELIEF_K = 1e-3;

/** Widest a peak's black point ever feathers out past the end of its own relief, as a fraction of that
 * peak's reach. Reached at MAX_MASK_PEAK_FALLOFF; a peak at MIN_MASK_PEAK_FALLOFF gets no halo at all,
 * and the band scales between the two (see PEAK_BLACK_POINT_HALO_EASE). The lift is at full strength
 * everywhere inside the relief regardless -- only the width of the join beyond it varies.
 *
 * Three decisions are packed in here.
 *
 * The lift is flat across the peak's body rather than following its own radial profile k(u), which is
 * what everything else about a peak fades by. A black point is a *floor* on how dark the peak may get,
 * and a floor that fades is not a floor: k(u) is already down to 0.56 halfway out on the default dome,
 * so weighting by it would let the whole middle of the peak drift back toward black -- the exact thing
 * the swatch exists to prevent. k earns exactly one job here, deciding where the body *ends* (see
 * PEAK_BLACK_POINT_RELIEF_K), and none at all in how strongly the lift applies within it.
 *
 * The join then has to live OUTSIDE that boundary rather than just inside it, and that is forced by
 * falloff. The profile's slope is dk/du = -2*f*u*(1 - u^2)^(f-1), so at the default falloff of 2 the
 * (1 - u^2) factor takes the rim slope to zero and a peak's shading has already died out before the
 * rim -- an inward feather there is harmless. At MIN_MASK_PEAK_FALLOFF the exponent is zero, that
 * factor disappears, and the slope is -2u: *maximal at the rim* (a gradient of 1.33 against 0.01 for
 * the dome). The peak's darkest ring sits exactly at u = 1, so an inward feather switches the floor off
 * precisely where it is needed most and leaves a black band around the peak -- which is what it did.
 * There is no safe place inside a low-falloff peak to put that transition, because there the darkest
 * point IS the boundary.
 *
 * The width of that join then tracks falloff, for the same reason its side does. A halo exists to hide
 * the colour discontinuity where lifted meets unlifted, and how much hiding that needs is exactly how
 * smoothly the peak already meets the mesh -- which is what falloff controls. At the maximum the peak
 * dissolves into flat mesh with no edge of its own, so a bare cutoff would be the only hard line
 * anywhere near it and the join needs the full width. At the minimum the rim already carries a hard
 * ~191/255 step from the crease (see MIN_MASK_PEAK_FALLOFF, where that crease is called out as
 * deliberate), so a colour transition in that same place lands inside an edge that is already there --
 * and a halo would instead bleed colour past a peak that reads as crisply bounded, which is the wrong
 * look for it twice over.
 *
 * The ceiling itself is sized by the halo's own gradient, which has to stay under roughly 4/255 per
 * pixel to read as shading rather than as a ring. 0.2 holds that for any peak of a reasonable size,
 * and is only marginal for a small peak sitting on very dark mesh. */
export const PEAK_BLACK_POINT_HALO_MAX = 0.2;

/** Exponent shaping how a peak's halo grows from none at MIN_MASK_PEAK_FALLOFF to
 * PEAK_BLACK_POINT_HALO_MAX at MAX_MASK_PEAK_FALLOFF: width = MAX * t^this, for t the falloff's own
 * normalized position in that range.
 *
 * Below 1, so the halo widens fast as falloff leaves its minimum and then slowly. That asymmetry
 * matches what it is hiding behind rather than being a taste call. The crease at a peak's rim does not
 * decay linearly with falloff -- it collapses, measuring roughly 190/255 at the minimum, 9/255 by
 * falloff 2 and nothing at all by 3. A linear halo is therefore still only a fifth of its width at the
 * exact falloff where the crease has already stopped covering for it, which leaves the halo itself as
 * the most visible edge anywhere near the peak across most of the usable range -- the artifact
 * reappearing in a new place rather than being fixed.
 *
 * Empirical rather than derived: the crease's collapse has no clean closed form to inverting (it is a
 * discontinuity in the profile's rim slope, zero for every falloff above the minimum and 2 exactly at
 * it), so this is the exponent that measured best against it. 0.35 keeps the worst edge near a peak
 * under ~4/255 per pixel at every falloff except a single marginal 4.4 around 2.5. The endpoints are
 * untouched by it: t^anything is still 0 at 0 and 1 at 1, so "minimum falloff means no halo, maximum
 * means the full one" holds exactly. */
export const PEAK_BLACK_POINT_HALO_EASE = 0.35;

/** Exponent shaping how the lift fades ACROSS a peak's halo: weight = (1 - t)^this, for t the
 * fragment's own position in the band (0 at the rim, 1 at the halo's outer edge).
 *
 * Not to be confused with PEAK_BLACK_POINT_HALO_EASE just above, which shapes how the halo's *width*
 * grows with falloff. That one decides how far the band reaches; this one decides what happens inside
 * it.
 *
 * Above 1, which is what makes the halo blend outward from the rim rather than sitting as a collar
 * that fades late. The obvious choice here is a smoothstep, and it is wrong for exactly one reason:
 * smoothstep has zero slope at *both* ends, so it leaves the first fifth of the band above 90% tint
 * before anything visibly changes. That reads as a solid ring of colour hugging the peak with a fade
 * somewhere beyond it, rather than as a blend. This curve starts at full rate instead (slope 1.5 at
 * the rim, against smoothstep's 0), which cuts that band to 7%.
 *
 * It still has to land softly, though, which is what rules out the plain linear fade: (1 - t) arrives
 * at the outer edge with slope 1, and a gradient that stops abruptly draws a faint Mach line exactly
 * where the halo is supposed to have become invisible. Any exponent above 1 lands with slope 0.
 *
 * 1.5 specifically because it is the largest such exponent whose maximum slope is still 1.5 -- the
 * same worst gradient smoothstep already had, so starting the fade at the rim costs nothing against
 * the per-pixel budget PEAK_BLACK_POINT_HALO_MAX was sized against. (1 - t)^2 blends sooner but peaks
 * at slope 2, a third over that budget.
 *
 * Both ends are exact regardless: (1 - t)^n is 1 at the rim and 0 at the outer edge for every n, so
 * the halo reaches the mask's own untouched colour precisely rather than asymptotically. */
export const PEAK_BLACK_POINT_HALO_FADE = 1.5;

/** Gain on the relief each real light source contributes through the perturbed normal (see the
 * fragment shader's bump term). Multiplies a quantity already in 0-1, so this is "how strongly does
 * a slope read as lit/shadowed", not a unit conversion. */
export const MASK_BUMP_STRENGTH = 0.85;

/** How high above the mesh plane a light source hangs, as a multiple of its own core radius.
 *
 * A light carries no height of its own (only center/radius/falloff/intensity/darkness), so it
 * borrows the one length it already has in these same mesh pixels. That's a defensible choice on
 * three counts: it puts the light at 45 degrees over the rim of its own bright core, so it is
 * already grazing by the time it reaches the rest of the mesh, which is exactly the raking angle
 * that makes a bump read; it can never be 0 (drawMaskMesh clamps radius to >= 1) and a light at
 * height 0 would sit in the mesh's own plane where N.L is ~0 everywhere and the relief collapses;
 * and it makes the existing light-size slider double as "how high the light hangs", so a big soft
 * light sits high and flattens the relief while a small one rakes it. If this ever needs
 * decoupling, it becomes one more per-light uniform alongside the five that exist. */
export const MASK_LIGHT_HEIGHT_SCALE = 1.0;

/** How far, in mesh pixels, the straight edge between two vertices is allowed to miss where the GPU
 * actually bends it before the subdivision pass inserts another vertex along it (see
 * edgeSubdivisionCount). Smaller means a smoother dome and more triangles. */
export const PEAK_SUBDIVISION_TOLERANCE_PX = 0.75;

/** Width, in constant screen pixels, of the per-triangle wireframe stroke (see edge/STROKE_WIDTH_PX
 * in the fragment shader below) -- change this rather than the shader's own #define. */
export const MASK_STROKE_WIDTH_PX = 1.0;

/** Width, in constant screen pixels, of the always-visible highlight stroke drawn around an active
 * capture's or active topology peak's own triangles (see highlightEdge/HIGHLIGHT_STROKE_WIDTH_PX
 * in the fragment shader below) -- change this rather than the shader's own #define. A separate
 * constant from MASK_STROKE_WIDTH_PX rather than reusing it: this stroke is meant to read as a
 * bold, always-visible outline, not the subtle per-facet wireframe that one drives, and the two
 * have always been visually distinct widths. */
export const MASK_HIGHLIGHT_STROKE_WIDTH_PX = 3.0;

/** Color (RGB) and max opacity (A) the per-triangle wireframe stroke fades to at full strength --
 * see STROKE_COLOR/STROKE_ALPHA/strokeColor in the fragment shader below -- change this rather
 * than the shader's own consts. All 0-1. The color still darkens under a light source's shadow
 * the same way the rest of the mesh does (see strokeColor's own comment), this is just its lit
 * baseline; the alpha caps how opaque the stroke can ever get, multiplied in on top of
 * u_textureMix -- 1 lets u_textureMix alone reach full opacity, lower values mean even
 * u_textureMix=1 stays partially see-through. */
export const MASK_STROKE_COLOR: [number, number, number, number] = [1.0, 1.0, 1.0, 0.2];

/** Single source of truth for the always-visible highlight stroke color shared by a mesh's active
 * captures and its active topology peaks alike (drawn along the highlighted triangles' own edges,
 * see a_highlight/v_highlight in the vertex shader below and captureEdge/withCaptureStroke in the
 * fragment shader) -- both read this one constant rather than carrying their own copy, so the two
 * flavors of highlight can never drift apart. Matches the
 * rgba(66, 133, 244, 1) selection outline drawn around a selected media item (project-img.tsx/
 * project-svg.tsx/project-mask-item.tsx). See HIGHLIGHT_STROKE_COLOR in the shader below -- change
 * this constant, not that one. */
export const HIGHLIGHT_STROKE_COLOR: [number, number, number] = [0.258824, 0.521569, 0.956863];

// GLSL ES 1.00 requires float literals to carry a decimal point (an implicit int->float
// conversion where this gets spliced in, e.g. STROKE_WIDTH_PX's multiply against a vec3, is a
// compile error) -- toFixed guarantees one no matter how the JS constants above are written.
function glFloat(n: number): string {
  return n.toFixed(6);
}

/** A vertex/fragment GLSL pair, compiled and linked together into one WebGLProgram by createProgram. */
export interface Shader {
  vertex: string;
  fragment: string;
}

/** The single source of truth for a topology peak's geometry, spliced verbatim into *both* stages of
 * LIGHT_SOURCE_SHADER below. That sharing is the whole point of the arrangement: the vertex stage's
 * displacement (peakSwell) and the fragment stage's normals (peakField) are built out of the same
 * peakProfile, so the shape the mesh takes and the shape the light sees cannot drift apart. Two
 * copies of this math in two languages is exactly the bug this feature had before.
 *
 * The uniforms are explicitly mediump because a uniform declared in both stages is a *link* error if
 * their declared precisions disagree, and the two stages have different defaults (highp in the
 * vertex stage, mediump in the fragment stage) -- u_resolution below already carries the same
 * annotation for the same reason. Locals are left unqualified so each stage computes at its own
 * default precision: the vertex stage's crack-free guarantee needs the displacement to be a
 * deterministic pure function of a_position, not bit-identical to what the fragment stage computes.
 */
const PEAK_FIELD_GLSL = `
#define MAX_MASK_PEAKS ${MAX_MASK_PEAKS}
#define MASK_PEAK_SWELL ${glFloat(MASK_PEAK_SWELL)}
#define MASK_PEAK_SWELL_LIMIT ${glFloat(MASK_PEAK_SWELL_LIMIT)}
#define PEAK_SHAPE_SLOPE_RANGE ${glFloat(PEAK_SHAPE_SLOPE_RANGE)}
#define PEAK_SHAPE_MIN_RHO ${glFloat(PEAK_SHAPE_MIN_RHO)}
#define PEAK_GRADIENT_LIMIT ${glFloat(PEAK_GRADIENT_LIMIT)}
#define PEAK_FIELD_PI 3.141592653589793

// One peak per element: xy = epicenter, z = radius, w = signed elevation (negative is a dent).
// All in mesh space -- the same top-left-origin, y-down, buffer-pixel space a_position is in, since
// a mask's canvas is always drawn 1:1 against u_resolution, so no conversion is ever needed here.
//
// z is the peak's radius in the direction the shape reaches FURTHEST (see u_peakShapes): for an
// unshaped peak that is every direction, which is why a circle needs no special case anywhere below.
uniform mediump vec4 u_peaks[MAX_MASK_PEAKS];
// Each peak's own profile exponent -- see peakProfile. Separate from u_peaks only because that one
// is already full at vec4.
uniform mediump float u_peakFalloffs[MAX_MASK_PEAKS];
// How many of the arrays above are populated -- mirrors u_lightSourceCount exactly: drawMaskMesh
// only ever fills peaks that can contribute, so every index below this is implicitly active and
// there's no per-peak "enabled" flag to test. Explicitly mediump for the same link-error reason as
// u_peaks/u_peakFalloffs above (int defaults to highp in the vertex stage, mediump in the fragment
// stage).
uniform mediump int u_peakCount;

// The custom-shape table: one row per shaped peak, u_peakShapeSamples texels wide, holding that
// shape's normalized angular radius rho(theta) and its slope d(rho)/d(theta). See peakShapeAt.
// Explicitly mediump, which is NOT the default and is not merely defensive: GLSL ES 1.00 defaults
// sampler2D to lowp in both stages, and the precision of a sampler is the precision of what
// texture2D hands back. lowp guarantees only 8 bits of relative precision, so the low byte of every
// pair decodePeakShape16 reassembles would be rounded away entirely and the table would silently
// collapse to 8-bit -- visible as stair-stepping around a shaped peak's outline, with nothing in the
// compile log to explain it.
uniform mediump sampler2D u_peakShapes;
// Which row of u_peakShapes each peak reads, or a negative value for "this peak is a circle" -- the
// overwhelmingly common case, and the one that must cost nothing, so it short-circuits before any
// texture fetch happens at all. Also the whole fallback mechanism: where vertex texture fetch is
// unavailable (see initGLState), drawMaskMesh writes -1 here for every peak and shaped peaks
// gracefully render as the circles they are a generalization of, in both stages consistently.
uniform mediump float u_peakShapeRows[MAX_MASK_PEAKS];
// The table's width, passed rather than compiled in so that this module keeps its promise of having
// no runtime imports (see the type-only import on line 1) -- the sampler that produces the table
// lives in canvas-media/peak-shape.ts, and importing its PEAK_SHAPE_SAMPLES for real would break
// peak-field.test.ts's ability to load this file under bare type stripping.
uniform mediump float u_peakShapeSamples;

// One 16-bit value out of a byte pair, as encodePeakShapeTexture wrote it: the high byte carries
// value*255 truncated, the low byte carries the remainder. Kept in [0, 1] the whole way rather than
// reassembled as (high*256 + low) -- mediump is only guaranteed 2^14 of range and 2^-10 of relative
// precision, so the reassembled form would both overflow and quantize on exactly the hardware the
// annotation exists to support.
float decodePeakShape16(vec2 bytes) {
  return bytes.x + bytes.y * (1.0 / 255.0);
}

// One shaped peak's rho(theta) and d(rho)/d(theta), or (1, 0) for a circle.
//
// This is what makes a peak's radius a *function of direction* instead of a scalar. rho is in (0, 1]
// with a maximum of exactly 1, so u_peaks[i].z stays the peak's furthest reach and every guarantee
// stated in terms of it survives untouched -- most importantly that the field is identically 0 at and
// beyond the rim in EVERY direction, since u still reaches 1 exactly at the outline.
//
// Filtering is done by hand off a NEAREST texture rather than by asking GL for LINEAR, and that is
// not a preference. The table is 16-bit, stored as byte pairs, and hardware filtering would
// interpolate the high and low bytes independently -- so anywhere the low byte wraps (254 -> 0 as the
// high byte ticks up) it would blend through the entire range and spike. Fetching both texels and
// mixing the DECODED values is the same interpolation done in the one order that is meaningful. The
// second fetch reads past the last texel on purpose: the texture is power-of-two and wrapped REPEAT,
// so theta = +pi lands back on theta = -pi and the seam interpolates like any other texel boundary.
//
// IMPORTANT for anyone tempted to move the call sites: every fetch below must stay in *uniform*
// control flow. A fragment-stage texture2D computes its LOD from implicit derivatives, which the spec
// leaves undefined once the quad's four fragments disagree about whether the fetch happens. Both
// callers therefore look a shape up BEFORE testing u >= 1.0, even though that means occasionally
// fetching for a point the peak turns out not to reach -- the obvious "optimization" of moving the
// lookup after that test is exactly what makes the flow non-uniform. The two conditions guarding the
// fetch as written (the loop's break on u_peakCount, and the row < 0.0 early return) both read
// uniforms only, so every fragment in a quad agrees.
vec2 peakShapeAt(float row, float theta) {
  if (row < 0.0) return vec2(1.0, 0.0);
  float t = (theta + PEAK_FIELD_PI) / (2.0 * PEAK_FIELD_PI) * u_peakShapeSamples;
  float index = floor(t);
  float v = (row + 0.5) / float(MAX_MASK_PEAKS);
  vec4 lower = texture2D(u_peakShapes, vec2((index + 0.5) / u_peakShapeSamples, v));
  vec4 upper = texture2D(u_peakShapes, vec2((index + 1.5) / u_peakShapeSamples, v));
  vec2 pair = mix(
    vec2(decodePeakShape16(lower.rg), decodePeakShape16(lower.ba)),
    vec2(decodePeakShape16(upper.rg), decodePeakShape16(upper.ba)),
    t - index);
  // The field divides by rho -- and, in the gradient, by rho squared -- so a genuinely tiny lobe (or
  // quantization landing one on 0) is an overflow rather than merely a small number. See
  // PEAK_SHAPE_MIN_RHO.
  return vec2(max(pair.x, PEAK_SHAPE_MIN_RHO), (pair.y * 2.0 - 1.0) * PEAK_SHAPE_SLOPE_RANGE);
}

// One peak's radial profile and its analytic derivative, at u = clamp(dist / radius, 0, 1):
//
//   k(u)     = (1 - u^2)^falloff                      1 at the epicenter, 0 at the rim
//   dk/du    = -2*falloff*u*(1 - u^2)^(falloff - 1)
//
// falloff = 2 is the default and gives the smooth dome (1 - u^2)^2, whose slope vanishes at BOTH
// ends -- that C1 join at the rim is what lets a peak sit mid-mesh with no crease ring around it.
// falloff = 1 gives the paraboloid, whose rim slope is -2: a deliberate crease, not a bug.
//
// This is the ONLY place the profile appears; everything below is built from it. Returned as a pair
// rather than as two functions so a caller cannot evaluate the height and the slope at accidentally
// different inputs.
vec2 peakProfile(float u, float falloff) {
  float s = max(1.0 - u * u, 0.0);
  // pow(0.0, e) is undefined in GLSL ES for e <= 0, and the derivative's own exponent (falloff - 1)
  // goes negative for any falloff < 1. MIN_MASK_PEAK_FALLOFF keeps the UI out of that range, but a
  // document stored before that bound existed can still carry one, so the base is floored rather
  // than trusted. Small enough to be indistinguishable from 0 in the profile itself.
  float sSafe = max(s, 1e-4);
  float k = pow(sSafe, falloff);
  float dk = -2.0 * falloff * u * pow(sSafe, falloff - 1.0);
  return vec2(k, dk);
}

// The whole height field at p, and its gradient, summed over every active peak:
//
//   h(p)       = sum_i  E_i * k(u_i),                 u_i = |p - c_i| / R_i(theta_i)
//   R_i(theta) = u_peaks[i].z * rho_i(theta)          this peak's reach in that one direction
//   grad u_i   = (1 / R_i) * radial_i
//                  - (rho_i' / (u_peaks[i].z * rho_i^2)) * tangential_i
//   grad h(p)  = sum_i  E_i * dk/du(u_i) * grad u_i
//
// The tangential term is the whole difference between a shaped peak and a circular one, and it is
// not optional. Height alone already makes the mesh bulge in the silhouette's outline -- but the
// fragment stage lights the surface from grad h, and with a purely radial gradient every point would
// be lit as though its slope ran straight out from the epicenter. A star would read as a circular
// dome that happens to be clipped into a star, which is the giveaway that the relief is fake. The
// rho'/rho^2 term tilts the normal sideways wherever the outline turns, and that is what the eye
// actually reads as the shape being three-dimensional. It falls out of the chain rule rather than
// being authored: u depends on theta now, so grad u picks up (1/dist) * du/dtheta along the tangent
// and the dist cancels.
//
// For a circle rho is 1 and rho' is 0, so both new factors vanish identically and this reduces to the
// plain radial form it replaces -- exactly, not approximately.
//
// Returns vec3(dh/dx, dh/dy, h) out of a single loop, so a caller can never pair a height with a
// gradient computed from different inputs. Heights and positions are both in mesh pixels, which
// makes the gradient dimensionless -- a true slope, directly usable as a normal below. The sum is
// linear, and that linearity is what makes an overlapping bump and dent of equal magnitude cancel
// exactly rather than fight.
vec3 peakField(vec2 p) {
  vec3 field = vec3(0.0);
  for (int i = 0; i < MAX_MASK_PEAKS; i++) {
    if (i >= u_peakCount) break;
    vec2 toPoint = p - u_peaks[i].xy;
    float elevation = u_peaks[i].w;
    float dist = length(toPoint);
    // atan is undefined at the epicenter -- where u is 0 whatever the direction, so any angle serves.
    float theta = dist > 1e-4 ? atan(toPoint.y, toPoint.x) : 0.0;
    vec2 shape = peakShapeAt(u_peakShapeRows[i], theta);
    float radius = u_peaks[i].z * shape.x;
    float u = dist / radius;
    if (u >= 1.0) continue;
    vec2 profile = peakProfile(u, u_peakFalloffs[i]);
    field.z += elevation * profile.x;
    // The radial direction is undefined exactly at an epicenter -- but dk/du is 0 there, so the
    // whole gradient term vanishes anyway; skip it rather than normalize a zero-length vector.
    if (dist > 1e-4) {
      vec2 radial = toPoint / dist;
      vec2 tangential = vec2(-radial.y, radial.x);
      vec2 gradU = radial / radius - tangential * (shape.y / (u_peaks[i].z * shape.x * shape.x));
      // Clamped BEFORE the elevation scales it, and the accumulator clamped again after, purely to
      // keep every intermediate inside mediump -- see PEAK_GRADIENT_LIMIT for why neither ever binds
      // on a real shape. The order is what matters: clamping only the sum would leave the product
      // (elevation * dk/du * gradU) free to overflow on its way there, which is exactly the term that
      // blows up for a needle-thin lobe.
      gradU = clamp(gradU, -PEAK_GRADIENT_LIMIT, PEAK_GRADIENT_LIMIT);
      field.xy = clamp(
        field.xy + (elevation * profile.y) * gradU, -PEAK_GRADIENT_LIMIT, PEAK_GRADIENT_LIMIT);
    }
  }
  return field;
}

// The deliberately-authored part. This mesh is flat and viewed straight down, so an orthographic
// projection of a dome would move nothing at all in the plane -- there is no camera to derive an
// in-plane displacement from, and the "swell" that reads as a surface bulging toward the viewer has
// to be authored outright. This is a weak-perspective (first-order) projection of the height field
// with one camera axis per peak, running through that peak's own epicenter:
//
//   dp(p) = MASK_PEAK_SWELL * sum_i (h_i(p) / R_i(theta_i)) * (p - c_i)
//         = MASK_PEAK_SWELL * sum_i  h_i(p) * u_i * radial_i
//
// R_i is the peak's LOCAL reach in this point's own direction (u_peaks[i].z * rho), not its maximum,
// and using the local one is what carries all four properties below across to shaped peaks unchanged.
// The second line is the reason: |p - c_i| is u_i * R_i, so R_i cancels out of the product entirely
// and the displacement is still exactly h * u * radial, whatever shape rho describes. In particular
// the pixel bound is still |dp| <= 0.385 * MASK_PEAK_SWELL * |elevation|, with no rho in it. What
// does change is that the fold guard engages sooner inside a narrow lobe, where R_i is small and the
// coefficient SWELL*h/R_i is correspondingly larger -- which is correct, since a narrow lobe is
// exactly where a big negative elevation would otherwise fold the mesh through itself.
//
// i.e. every point is pushed out along its own radial by how high it is, scaled by how far out it
// already is. Four properties earn this profile over the alternatives:
//   * exactly 0 at the epicenter (that point is on its own axis) AND exactly 0 at and beyond the
//     rim (h is 0 there) for EVERY falloff -- so a peak can never disturb a vertex outside its own
//     radius, and a subdivided triangle can never tear away from an unsubdivided neighbour;
//   * a pure function of p alone, so two triangles sharing a corner are displaced identically by
//     construction and cracks are impossible without any welding at all -- unlike the CPU warp this
//     replaces, which needed shared array references to stay watertight (see weldPoints);
//   * built from the same peakProfile the shading reads, so swell and relief always agree;
//   * bounded in pixels independent of radius: u*k(u) maximises at u = 1/sqrt(1 + 2*falloff) with
//     value u* * (2f/(1+2f))^f, which is <= 0.385 for every falloff >= 1. So
//     |dp| <= 0.385 * MASK_PEAK_SWELL * |elevation| px, and one constant tunes the whole feature.
//
// Displacing along the gradient instead (dp proportional to -grad h) was the obvious alternative and
// is wrong here: same radial direction, but weighted by |dk/du|, which is NONZERO at the rim for
// falloff < 2 -- a peak would then displace vertices sitting right on its own boundary and tear away
// from the untouched geometry just outside it. u*k(u) vanishes at the rim for every falloff.
//
// The clamp is the one guard: a large negative elevation on a small radius would otherwise pull
// points past the epicenter and fold the mesh inside out (the coefficient reaches
// SWELL*|E|/R as u -> 0). See MASK_PEAK_SWELL_LIMIT.
vec2 peakSwell(vec2 p) {
  vec2 swell = vec2(0.0);
  for (int i = 0; i < MAX_MASK_PEAKS; i++) {
    if (i >= u_peakCount) break;
    vec2 toPoint = p - u_peaks[i].xy;
    float dist = length(toPoint);
    float theta = dist > 1e-4 ? atan(toPoint.y, toPoint.x) : 0.0;
    float radius = u_peaks[i].z * peakShapeAt(u_peakShapeRows[i], theta).x;
    float u = dist / radius;
    if (u >= 1.0) continue;
    float height = u_peaks[i].w * peakProfile(u, u_peakFalloffs[i]).x;
    float coefficient = clamp(
      MASK_PEAK_SWELL * height / radius, -MASK_PEAK_SWELL_LIMIT, MASK_PEAK_SWELL_LIMIT);
    swell += coefficient * toPoint;
  }
  return swell;
}
`;

export const LIGHT_SOURCE_SHADER: Shader = {
  vertex: `
attribute vec2 a_position;
attribute vec3 a_color;
attribute vec3 a_barycentric;
attribute vec2 a_uv;
// Every vertex of a triangle carries the same value here (its parent triangle's centroid, in
// the same space as a_position) -- see a_color for the same trick. Since all 3 corners agree,
// interpolating it across the triangle's interior can't produce anything but that one constant
// value, which is what lets the fragment shader treat a whole triangle as one light source facet
// instead of a continuous per-pixel gradient.
attribute vec2 a_centroid;
// 1.0 for every vertex of a triangle the app wants outlined (an active capture's or active
// topology peak's own triangles, tagged via PolygonPath_V1_0's capture_id/peak_id -- see
// ProjectMaskItem's recolorHighlight), 0.0 otherwise. A per-vertex float rather than a uniform
// flag so a single draw call can outline an arbitrary subset of the mesh's triangles.
attribute float a_highlight;

// Explicit mediump (this stage's own default is highp) so this links against the fragment
// shader's own declaration below, which inherits mediump from that stage's precision mediump
// float default -- a vertex/fragment pair disagreeing on a uniform's precision is a link error,
// not just a warning.
uniform mediump vec2 u_resolution;

varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;
varying vec2 v_lightSourcePos;
varying float v_highlight;
// This vertex's own UNdisplaced mesh-space position -- the fragment stage's coordinate into the
// height field. See its assignment below for why it deliberately isn't the displaced one.
varying vec2 v_meshPos;
${PEAK_FIELD_GLSL}
void main() {
  // A topology peak's swell is a render-time displacement again, after a spell being baked into
  // a_position on the CPU. What makes that safe is that peakSwell is a pure function of a_position
  // (see its own comment in the shared kernel above): two triangles that share a corner hand the
  // same input to the same function, so cracks are impossible by construction rather than by
  // carefully keeping duplicate corner coordinates bit-identical. The CPU no longer moves any point
  // at all -- its only remaining geometric job is inserting extra vertices near a peak so that this
  // displacement has something to bend (see subdivideMeshForPeaks, mask-gl.ts).
  vec2 displaced = a_position + peakSwell(a_position);
  vec2 zeroToOne = displaced / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_color = a_color;
  v_barycentric = a_barycentric;
  v_uv = a_uv;
  // Undisplaced on purpose. This is a *material* coordinate: it has to travel with the triangle when
  // the swell moves it, not slide underneath it, or the relief would visibly crawl across the
  // surface as a peak's own parameters change. Exactly the same reasoning as v_uv's, one line up.
  v_meshPos = a_position;
  // Swelled by the same field as the position above, so a facet's own distance-to-light anchor
  // tracks where that facet is actually drawn -- which is what the old CPU pipeline did implicitly,
  // since it took centroids of points it had already warped.
  vec2 centroid = a_centroid + peakSwell(a_centroid);
  // a_centroid arrives in the same top-left/y-down space as a_position; flip it to match
  // gl_FragCoord's bottom-left origin, which is the space u_lightSourceCenter is given in.
  v_lightSourcePos = vec2(centroid.x, u_resolution.y - centroid.y);
  v_highlight = a_highlight;
}
`,
  fragment: `
#extension GL_OES_standard_derivatives : enable
precision mediump float;
${PEAK_FIELD_GLSL}
varying vec3 v_color;
varying vec3 v_barycentric;
varying vec2 v_uv;
varying vec2 v_lightSourcePos;
varying float v_highlight;
// This fragment's own position in the mesh's undisplaced coordinate space -- the argument to
// peakField below. See the vertex stage's own assignment for why it isn't the displaced position.
varying vec2 v_meshPos;

// Gain on the relief each real light source contributes -- spliced in from MASK_BUMP_STRENGTH.
#define BUMP_STRENGTH ${glFloat(MASK_BUMP_STRENGTH)}
// How high a light hangs above the mesh plane, as a multiple of its core radius -- spliced in from
// MASK_LIGHT_HEIGHT_SCALE, whose comment carries the justification for borrowing the radius.
#define LIGHT_HEIGHT_SCALE ${glFloat(MASK_LIGHT_HEIGHT_SCALE)}

// Same resolution the vertex shader normalizes a_position by (see u_resolution there) -- lets this
// stage recover a fragment's own position in that same buffer-pixel space straight from
// gl_FragCoord, independent of anything a peak's bulge did to the triangle it landed in.
uniform vec2 u_resolution;

// Single source of truth for the always-visible highlight stroke below: an active capture's or
// active topology peak's own outline alike (see a_highlight/v_highlight, drawn along the
// highlighted triangles' edges) -- neither tints the underlying fill, so the mesh's original
// colors stay untouched underneath the stroke. Spliced in from HIGHLIGHT_STROKE_COLOR above;
// change that constant, not this line.
const vec3 HIGHLIGHT_STROKE_COLOR = vec3(${HIGHLIGHT_STROKE_COLOR.map(glFloat).join(", ")});

// The per-triangle wireframe stroke's own lit-baseline color and max opacity -- see strokeColor/
// withEdge below. Spliced in from MASK_STROKE_COLOR above; change that constant, not these lines.
const vec3 STROKE_COLOR = vec3(${MASK_STROKE_COLOR.slice(0, 3).map(glFloat).join(", ")});
const float STROKE_ALPHA = ${glFloat(MASK_STROKE_COLOR[3])};

// A mesh can carry several captures (see project-mask-item.tsx), each its own light source --
// Play All animates every one of them at once (project-mask-item.tsx's playLightSourceAnimation),
// so this can no longer be one scalar epicenter. MAX_LIGHT_SOURCES bounds a GLSL ES 1.00 array's
// size, which has to be a compile-time constant -- generous relative to how many captures a mask
// realistically carries; drawMaskMesh (mask-gl.ts) silently drops anything past it.
#define MAX_LIGHT_SOURCES 8

// Target width, in screen pixels, of the per-triangle wireframe stroke below -- see edge's own
// comment for why this needs fwidth() rather than a fixed barycentric threshold. Spliced in from
// MASK_STROKE_WIDTH_PX above -- change that constant, not this line.
#define STROKE_WIDTH_PX ${glFloat(MASK_STROKE_WIDTH_PX)}
// Mirrors STROKE_WIDTH_PX exactly, for the bolder always-visible highlight stroke (highlightEdge
// below) instead of the subtle per-facet wireframe. Spliced in from MASK_HIGHLIGHT_STROKE_WIDTH_PX
// above -- change that constant, not this line.
#define HIGHLIGHT_STROKE_WIDTH_PX ${glFloat(MASK_HIGHLIGHT_STROKE_WIDTH_PX)}

// Every light source's own center is in gl_FragCoord space (drawing-buffer pixels, origin
// bottom-left); radius/falloff are likewise in drawing-buffer pixels so they survive the canvas
// being displayed at a different size than its backing resolution.
//
// Each is a light source for the whole mesh, not just a local glow: triangles inside its own
// u_lightSourceRadii[i] sit in its bright core, and everything further out darkens smoothly over
// the next u_lightSourceFalloffs[i] pixels, giving the flat-shaded mesh a 3D relief instead of an
// isolated highlight. The falloff is a distance, not a canvas-relative fraction, so it's tunable
// independent of how big the mesh happens to be on screen.
uniform vec2 u_lightSourceCenters[MAX_LIGHT_SOURCES];
uniform float u_lightSourceRadii[MAX_LIGHT_SOURCES];
uniform float u_lightSourceFalloffs[MAX_LIGHT_SOURCES];
// Brightness of each light's own core, 0-1 -- 1.0 mixes its epicenter fully to white rather than
// just tinting it.
uniform float u_lightSourceIntensities[MAX_LIGHT_SOURCES];
// Strength of each light's own darkening at the far edge of its spread, 0-1 -- 1.0 drives it
// fully to black.
uniform float u_lightSourceDarknesses[MAX_LIGHT_SOURCES];
// How many of the arrays above are actually populated -- drawMaskMesh only ever fills (and only
// ever counts) lights with a positive radius, so every index below this is implicitly active;
// there's no separate "active" flag to check per-light.
uniform int u_lightSourceCount;

// The alpha (0 invisible, 1 fully visible) each triangle's own edge stroke renders at -- see
// edge/withEdge below. The mesh's own fill is never driven by this; see base below, which always
// reads straight off the source image.
uniform float u_textureMix;
// The source image, sampled at this fragment's own UV -- the mesh's base fill (see base below).
// Bound but unused (see u_hasTexture) whenever it hasn't loaded yet, or couldn't (a mask dropped
// from a browser thumbnail with no locally resolvable src at mount, cross-origin failure, etc.) --
// see project-mask-item.tsx's own sourceImgSrc resolution.
uniform sampler2D u_texture;
// 1 once u_texture has a real image bound, 0 otherwise -- forces the base fill to v_color while
// nothing has loaded, rather than sampling an empty/stale texture. See base below.
uniform float u_hasTexture;

// The silhouette curves, rasterized to a coverage mask. WebGL has no
// equivalent of a 2d context's ctx.clip(), so the clip becomes a multiply on
// alpha here: this is what gives the shape its smooth curved edge instead of
// the mesh's faceted one. Its own antialiasing comes free, since the mask is
// filled on a 2d canvas. 0 when the source had no alpha channel and so no
// silhouette to trace, in which case nothing is clipped away.
//
// .a is coverage, including the glow's soft falloff outside the silhouette.
// .r says how much of that coverage is glow rather than subject: 1 out in the
// falloff, 0 within the shape. The glow is its own colour -- a drop shadow is
// dark, a neon glow saturated, neither is the subject's mean -- so it can't
// just inherit whatever the mesh underneath happens to be.
uniform sampler2D u_mask;
uniform float u_maskActive;
uniform vec3 u_glowColor;

// Each peak's own black point: .rgb is the colour that peak's shading bottoms out at, .a is how much
// of it applies at all -- 0 for every peak until someone opens the swatch, which is why an untouched
// mesh needs no special case below.
//
// Fragment-only, unlike u_peaks and friends in the shared kernel above: nothing in the vertex stage
// lights anything, so this neither costs a vertex uniform register nor needs the explicit mediump
// annotation those carry to keep the two stages' declared precisions from disagreeing at link time.
uniform vec4 u_peakBlackPoints[MAX_MASK_PEAKS];

// The widest a black point's halo ever reaches past a peak's rim, and the falloff range that halo is
// scaled across -- spliced in from PEAK_BLACK_POINT_HALO_MAX and MIN/MAX_MASK_PEAK_FALLOFF above.
// PEAK_BLACK_POINT_HALO_MAX's own comment carries the justification for all three. Change those
// constants, not these lines.
#define BLACK_POINT_HALO_MAX ${glFloat(PEAK_BLACK_POINT_HALO_MAX)}
#define BLACK_POINT_HALO_EASE ${glFloat(PEAK_BLACK_POINT_HALO_EASE)}
#define BLACK_POINT_HALO_FADE ${glFloat(PEAK_BLACK_POINT_HALO_FADE)}
#define BLACK_POINT_RELIEF_K ${glFloat(PEAK_BLACK_POINT_RELIEF_K)}
#define PEAK_FALLOFF_MIN ${glFloat(MIN_MASK_PEAK_FALLOFF)}
#define PEAK_FALLOFF_MAX ${glFloat(MAX_MASK_PEAK_FALLOFF)}

// The black point in force at p: .rgb the colour, .a the weight to apply it at.
//
// A mask can carry overlapping peaks, so this is a weighted average of their colours rather than a
// winner. The weight is flat across each peak's body -- everywhere it still has relief -- and feathers
// to nothing over a halo beyond that, whose width is the peak's own falloff scaled across
// BLACK_POINT_HALO_MAX: none at all at the minimum, full at the maximum.
//
// The body is bounded by where the relief ends rather than by the peak's radius, and the two are only
// the same boundary at low falloff. A needle-shaped peak's height is gone long before its radius is,
// so anchoring to the radius tinted a flat unelevated annulus around it -- up to 27% of the footprint
// -- which rendered as an unshaded "base" ringing the peak. See PEAK_BLACK_POINT_RELIEF_K.
//
// That the join then sits outside the body is why a low-falloff peak doesn't wear a black ring, and
// that its width tracks falloff is why a peak with a crease of its own doesn't wear a halo either;
// see PEAK_BLACK_POINT_HALO_MAX for both.
//
// The returned weight is the max rather than the sum, for the same reason bestHighlight below uses
// max: two overlapping black points shouldn't lift one facet further than either of them asked for.
// Zero means nothing reaches here, and the caller leaves its shading alone.
//
// Mirrors peakField's own loop, u for u, with one deliberate difference beyond the weight: the cutoff
// is the far edge of the halo rather than the rim, since unlike the height field this does have
// something to say just outside a peak. The shape lookup still happens BEFORE that test -- see
// peakShapeAt's own comment on why the fetch has to stay in uniform control flow.
vec4 peakBlackPoint(vec2 p) {
  vec3 color = vec3(0.0);
  float total = 0.0;
  float weight = 0.0;
  for (int i = 0; i < MAX_MASK_PEAKS; i++) {
    if (i >= u_peakCount) break;
    vec2 toPoint = p - u_peaks[i].xy;
    float dist = length(toPoint);
    float theta = dist > 1e-4 ? atan(toPoint.y, toPoint.x) : 0.0;
    float radius = u_peaks[i].z * peakShapeAt(u_peakShapeRows[i], theta).x;
    float u = dist / radius;
    // Floored rather than trusted: drawMaskMesh already floors what it uploads, but the reciprocal
    // below divides by this and a document stored before MIN_MASK_PEAK_FALLOFF existed can carry
    // anything at all, zero included.
    float falloff = max(u_peakFalloffs[i], PEAK_FALLOFF_MIN);
    // Where this peak's relief ends: the u at which its profile has fallen to BLACK_POINT_RELIEF_K,
    // i.e. (1 - u^2)^falloff = K solved for u. This bounds the peak's *body*, which coincides with the
    // rim only at low falloff and pulls well inside it as the profile sharpens -- see
    // PEAK_BLACK_POINT_RELIEF_K for why the tint follows this rather than the authored radius.
    float reliefEnd = sqrt(max(1.0 - pow(BLACK_POINT_RELIEF_K, 1.0 / falloff), 0.0));
    // This peak's own halo width, from its own falloff: none at the minimum, BLACK_POINT_HALO_MAX at
    // the maximum, eased between (see BLACK_POINT_HALO_EASE for why that curve isn't a straight line).
    //
    // Clamped at the top as well because nothing caps what a stored falloff can be, and a value above
    // PEAK_FALLOFF_MAX would otherwise widen this peak's halo past the ceiling that sized it.
    float haloT = clamp((falloff - PEAK_FALLOFF_MIN) / (PEAK_FALLOFF_MAX - PEAK_FALLOFF_MIN), 0.0, 1.0);
    float halo = BLACK_POINT_HALO_MAX * pow(haloT, BLACK_POINT_HALO_EASE);
    if (u >= reliefEnd + halo) continue;
    // How far into the halo this fragment sits: 0 where the body ends, 1 at the halo's outer edge.
    // Divided by max(halo, 1e-4) rather than by halo itself because a peak at the minimum falloff has
    // no halo at all, and that degenerates cleanly into the step this case wants -- t is 0 inside the
    // body and 1 outside it, with no band in between, and no division by zero on the way.
    float t = clamp((u - reliefEnd) / max(halo, 1e-4), 0.0, 1.0);
    // The fade across that band: the lift blends outward from the body and reaches exactly zero at the
    // outer edge, so the halo arrives at the mask's own untouched colour rather than merely near it.
    // See BLACK_POINT_HALO_FADE for why this curve and not a smoothstep.
    float w = pow(1.0 - t, BLACK_POINT_HALO_FADE) * u_peakBlackPoints[i].a;
    color += u_peakBlackPoints[i].rgb * w;
    total += w;
    weight = max(weight, w);
  }
  // Guarded because the average divides by it: every peak reaching this fragment can legitimately
  // have a zero-alpha swatch, which is the common case rather than an edge one.
  return total > 0.0 ? vec4(color / total, weight) : vec4(0.0);
}

// One already-shaded colour, with the peak's black point installed as its floor.
//
// This is the photographic black point, not a tint: it rescales the whole 0-1 tonal range onto
// [blackPoint, 1] rather than blending toward a colour. 0 lands exactly on the swatch, 1 lands
// exactly on white, and everything between is carried proportionally -- so a green swatch means every
// tone in the peak is a shade of green running up to white, with pure black no longer reachable at
// all. A blend toward the swatch would instead leave the source photo's own dark pixels showing
// through the midtones, which is the thing this must not do.
//
// The clamp is what makes the floor a floor. The composite below deliberately leaves its subtraction
// unclamped (a facet in more than one light's full shadow can go negative), and a negative input
// would scale to something *below* the swatch -- the one outcome the whole feature exists to rule out.
//
// mix()ed by the weight rather than applied outright so this is exactly the identity where no peak
// reaches: at 0 the result is the untouched colour, including its negative components.
vec3 liftToBlackPoint(vec3 color, vec4 blackPoint) {
  vec3 lifted = blackPoint.rgb + clamp(color, 0.0, 1.0) * (1.0 - blackPoint.rgb);
  return mix(color, lifted, blackPoint.a);
}

void main() {
  // The polygon "stroke" texture controls (alpha via u_textureMix, see withEdge below) -- 1 right
  // at a triangle's own edge, fading to 0 over the next STROKE_WIDTH_PX screen pixels. Barycentric
  // coordinates span 0-1 across a triangle no matter its on-screen size, so a fixed threshold in
  // that space would read as a thick stroke on big triangles and a thin one on small ones --
  // including a peak's own triangles, which change on-screen size as they bulge, so a fixed
  // threshold would visibly grow/shrink the stroke as elevation/radius change even with nothing
  // else moving. fwidth(v_barycentric) is how fast each component changes per screen pixel here,
  // so dividing by it (via smoothstep's edge1) rescales the falloff into actual pixels -- the
  // standard single-pass wireframe technique. highlightEdge below reuses the same baryDeriv at its
  // own width for exactly the same reason.
  vec3 baryDeriv = fwidth(v_barycentric);
  vec3 edgeFactors = smoothstep(vec3(0.0), baryDeriv * STROKE_WIDTH_PX, v_barycentric);
  float edge = 1.0 - min(min(edgeFactors.x, edgeFactors.y), edgeFactors.z);
  vec3 highlightFactors = smoothstep(vec3(0.0), baryDeriv * HIGHLIGHT_STROKE_WIDTH_PX, v_barycentric);
  float highlightEdge = 1.0 - min(min(highlightFactors.x, highlightFactors.y), highlightFactors.z);

  // Sampled off the fragment's own on-screen position rather than the interpolated v_uv:
  // v_uv is carried per-vertex from each vertex's own *pre-bulge* position (see a_uv), so once a
  // peak pushes a triangle's vertices outward by different amounts, linearly interpolating those
  // per-vertex UVs across the now-larger/skewed triangle warps the sampled image right along with
  // it -- the same way any texture-mapped mesh warps its texture when displaced. This mesh isn't
  // meant to read as a lens bulging the photo, only as a shape (including a topology peak's own
  // silhouette) sitting over a fixed backdrop, so the sample has to stay pinned to screen position
  // instead: since a mask's canvas is always drawn 1:1 against u_resolution (see the vertex
  // shader's own a_position normalization), a fragment's true position in the untouched source
  // image is recoverable directly from gl_FragCoord no matter how far its triangle bulged to get
  // there.
  vec2 screenUV = gl_FragCoord.xy / u_resolution;
  // v_color is only ever reached here -- a missing/failed texture load's fallback, so the mesh
  // reads as its own flat baked-in color for that brief window rather than sampling garbage. No
  // per-triangle flat fill otherwise: a mask's own area is always the source photo, geometry
  // (including a topology peak's own bulge) drawn directly over it, the same as a capture's own
  // area -- neither adds any fill of its own on top of the source image.
  vec3 base = u_hasTexture > 0.5 ? texture2D(u_texture, screenUV).rgb : v_color;

  // v_lightSourcePos is constant across a triangle's interior (see a_centroid), so dist -- and
  // everything derived from it below -- is one flat value per triangle, not a smooth per-pixel
  // gradient. That's what makes the mesh's facets themselves read as the shading delimiters.
  //
  // Each active light contributes its own highlight/shadow at this facet; the brightest light's
  // highlight wins (mix() saturates past "fully lit" at 1.0, so summing would overshoot into
  // visible banding once two cores overlap) and the least-shadowed light's darkening wins (a
  // facet lit by any one nearby light shouldn't still read as fully shadowed just because a
  // second, farther light also has it inside its own falloff).
  // The bump map proper -- this is where the illusion of a peak actually comes from, as opposed to
  // the swell the vertex stage applied, which only moves the surface's footprint. peakField is the
  // same function that stage displaced with, so the surface being lit here is exactly the surface
  // being drawn.
  vec3 field = peakField(v_meshPos);
  // The outward normal of the surface z = h(x, y) is (-dh/dx, -dh/dy, 1): its tangents are
  // (1, 0, hx) and (0, 1, hy), whose cross product is that. Sanity check on the sign: on the +x
  // flank of a dome hx < 0, so n.x > 0 -- tilted outward, as a dome's surface is. Mesh space is
  // y-down, which makes this a left-handed frame; harmless, because every vector the dot products
  // below see is expressed in that same frame, and a dot product is invariant under a reflection
  // applied to both of its arguments.
  vec3 normal = normalize(vec3(-field.xy, 1.0));
  // Where this fragment's surface actually sits in 3D, so each light below gets a real direction to
  // it rather than one shared azimuth.
  vec3 surface = vec3(v_meshPos, field.z);
  // Relief is accumulated as two one-sided halves -- the slope facing a light and the slope facing
  // away -- because they feed opposite ends of the composite below (one mixes toward white, the
  // other subtracts). Seeded at zero and raised by each real light in turn: a mesh with no light
  // sources on it has no relief at all, so a peak sitting in a mask that carries no captures reads
  // as flat rather than as lit from some direction nothing in the document chose. There used to be a
  // fixed directional key light seeded in here instead, precisely so a peak would still be visible
  // at rest -- but "at rest" now means every capture's own persisted light is on (see
  // ProjectMaskItem's resolveRestingLightSources), so the real lights cover that case and an invented one
  // can only disagree with them about where the light is coming from.
  float bumpLit = 0.0;
  float bumpShade = 0.0;

  float bestHighlight = 0.0;
  float leastShadow = 0.0;
  for (int i = 0; i < MAX_LIGHT_SOURCES; i++) {
    if (i >= u_lightSourceCount) break;
    float dist = distance(v_lightSourcePos, u_lightSourceCenters[i]);
    // Bright core: full strength within the inner 35% of the radius.
    float highlight = 1.0 - smoothstep(u_lightSourceRadii[i] * 0.35, u_lightSourceRadii[i], dist);
    // Beyond the core, darken smoothly over the next falloff pixels -- this is what makes the
    // whole mesh read as lit from one point instead of just the disc.
    float shadow = smoothstep(u_lightSourceRadii[i], u_lightSourceRadii[i] + u_lightSourceFalloffs[i], dist);
    float shadowContribution = shadow * u_lightSourceDarknesses[i];
    bestHighlight = max(bestHighlight, highlight * u_lightSourceIntensities[i]);
    leastShadow = i == 0 ? shadowContribution : min(leastShadow, shadowContribution);

    // Lift this 2D light into 3D so the relief has a real direction to catch. The height it borrows
    // is its own core radius -- see LIGHT_HEIGHT_SCALE/MASK_LIGHT_HEIGHT_SCALE for why that
    // particular length. u_lightSourceCenters is in gl_FragCoord's bottom-left space, so it has to
    // come back into mesh space first: the reverse of the flip the vertex stage applies to
    // a_centroid.
    vec3 lightPos = vec3(u_lightSourceCenters[i].x,
                         u_resolution.y - u_lightSourceCenters[i].y,
                         u_lightSourceRadii[i] * LIGHT_HEIGHT_SCALE);
    vec3 lightDir = normalize(lightPos - surface);
    // RELATIVE Lambert: what this fragment's own slope earns over and above what the very same
    // fragment would have earned if the mesh were flat right there (a flat normal is (0, 0, 1), so
    // that baseline is exactly lightDir.z).
    //
    // This subtraction is the whole reconciliation with the mesh's existing look, and it's worth
    // being explicit about what it buys. Because it's a *difference*, the relief is identically 0
    // wherever the height field is flat -- whether that's a mask with no peaks at all or simply a
    // fragment outside every peak's radius -- so a peakless mesh renders exactly what it rendered
    // before this shader knew what a normal was, and the per-facet distance terms above are left
    // untouched: the mesh's own facets keep delimiting the shading exactly as they always did, with
    // the bump as a smooth per-fragment layer on top of that faceted base rather than a replacement
    // for it. It also removes an artifact a raw N.L would introduce -- a light more or less overhead
    // darkens every slope equally regardless of which way it faces, which reads as a vignette ring
    // around a peak rather than as a lit dome.
    float bump = dot(normal, lightDir) - lightDir.z;
    // Only as much relief as this light actually reaches with -- the exact complement of the shadow
    // term computed just above, so relief and darkness can never disagree about where this
    // particular light stops mattering.
    float reach = 1.0 - shadow;
    // max, not sum, for the same reason bestHighlight uses max: two overlapping lights shouldn't
    // drive one slope past fully lit.
    bumpLit = max(bumpLit, max(bump, 0.0) * reach * BUMP_STRENGTH);
    bumpShade = max(bumpShade, max(-bump, 0.0) * reach * BUMP_STRENGTH);
  }

  // mix (not additive) so bestHighlight at 1.0 reaches pure white at an epicenter instead of just
  // an oversaturated tint. bumpLit rides in alongside it (clamped, since two independent terms could
  // otherwise sum past 1.0 and mix would extrapolate past white) so that a slope tilted into a light
  // brightens the same way proximity to that light's core already does.
  vec3 lit = mix(base, vec3(1.0), min(bestHighlight + bumpLit, 1.0));
  // Whatever black point covers this fragment, resolved once and applied to both the fill and the
  // wireframe below so the two can't disagree about how dark this peak is allowed to get.
  vec4 blackPoint = peakBlackPoint(v_meshPos);
  // The shading as it has always been computed, then rescaled so the peak's darkest reachable tone is
  // the swatch rather than black (see liftToBlackPoint -- a levels remap, not a blend). Outside every
  // peak, and on any peak whose swatch alpha is 0, the lift is the identity and this is bit-for-bit
  // the line it replaced.
  vec3 shaded = liftToBlackPoint(lit - leastShadow - bumpShade, blackPoint);
  // The wireframe's own stroke endpoint darkens with the same shadow term as the fill above, so a
  // triangle sitting deep in a light source's shadow doesn't keep a bright hairline around it
  // while its interior goes dark. STROKE_COLOR (spliced in from MASK_STROKE_COLOR above -- change
  // that constant, not this line) is its lit baseline before that darkening. The bump's own shaded
  // half is subtracted here too, for exactly the same reason: a wireframe that stayed bright across
  // a peak's shadowed flank would read as a lit cage sitting over an unlit surface. And it takes the
  // same lift the fill just did, for that reason one step further: a stroke still able to reach black
  // across a peak whose fill cannot would read as a cage of a different material than its surface.
  vec3 strokeColor = liftToBlackPoint(STROKE_COLOR - leastShadow - bumpShade, blackPoint);
  // STROKE_ALPHA caps how far this can ever reach regardless of u_textureMix -- 1.0 leaves
  // u_textureMix as the sole ceiling, same as before the alpha channel existed.
  vec3 withEdge = mix(shaded, strokeColor, edge * u_textureMix * STROKE_ALPHA);

  // Deliberately still v_uv here, not screenUV -- unlike the photo above, the silhouette/glow clip
  // has to track the mesh's own shape, not a fixed screen position. v_uv is a convex interpolation
  // of each triangle's own true (pre-bulge) vertex positions, so it always reads the mask from
  // somewhere inside that triangle's real footprint in image space no matter how far the triangle
  // has bulged on screen -- the clip follows a peak's bulge and never cuts off a legitimately
  // interior triangle. screenUV would instead read the mask at the triangle's *bulged* on-screen
  // position, which can land outside the silhouette's own rasterized coverage once a peak pushes
  // it far enough -- exactly what was showing up as gaps/open/floating polygons under elevation.
  vec4 mask = texture2D(u_mask, v_uv);
  vec3 withGlow = mix(withEdge, u_glowColor, mask.r * u_maskActive);

  // A thicker, always-visible edge (independent of u_textureMix, unlike the subtle facet
  // wireframe above) around whichever triangles a_highlight marks -- an active capture's or
  // active topology peak's own triangles alike (see a_highlight's own comment) -- outline only,
  // the fill underneath is left exactly as shaded above. highlightEdge (computed above alongside
  // edge) is already constant-screen-pixel width, so this stays a fixed width regardless of a
  // triangle's on-screen size -- including a peak's own triangles mid-bulge.
  float captureEdge = highlightEdge * v_highlight;
  vec3 withCaptureStroke = mix(withGlow, HIGHLIGHT_STROKE_COLOR, captureEdge);

  gl_FragColor = vec4(withCaptureStroke, mix(1.0, mask.a, u_maskActive));
}
`,
};

export function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | undefined {
  const shader = gl.createShader(type);
  if (!shader) return undefined;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log("shader compile error", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return undefined;
  }
  return shader;
}

export function createProgram(gl: WebGLRenderingContext, shader: Shader): WebGLProgram | undefined {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, shader.vertex);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, shader.fragment);
  if (!vertexShader || !fragmentShader) return undefined;
  const program = gl.createProgram();
  if (!program) return undefined;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log("program link error", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return undefined;
  }
  return program;
}

export interface GLState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  barycentricBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  centroidBuffer: WebGLBuffer;
  highlightBuffer: WebGLBuffer;
  positionLoc: number;
  colorLoc: number;
  barycentricLoc: number;
  uvLoc: number;
  centroidLoc: number;
  highlightLoc: number;
  resolutionLoc: WebGLUniformLocation;
  lightSourceCentersLoc: WebGLUniformLocation;
  lightSourceRadiiLoc: WebGLUniformLocation;
  lightSourceFalloffsLoc: WebGLUniformLocation;
  lightSourceIntensitiesLoc: WebGLUniformLocation;
  lightSourceDarknessesLoc: WebGLUniformLocation;
  lightSourceCountLoc: WebGLUniformLocation;
  // The peak height field's own uniforms (see PEAK_FIELD_GLSL). Declared in both stages and so
  // shared: one location each, driving the vertex stage's displacement and the fragment stage's
  // normals together.
  peaksLoc: WebGLUniformLocation;
  peakFalloffsLoc: WebGLUniformLocation;
  peakCountLoc: WebGLUniformLocation;
  peakShapesLoc: WebGLUniformLocation;
  peakShapeRowsLoc: WebGLUniformLocation;
  peakShapeSamplesLoc: WebGLUniformLocation;
  /** Each peak's own black point (see u_peakBlackPoints in the fragment shader). Listed apart from
   * the peak uniforms above because it is the one that is *not* shared with the vertex stage: a black
   * point shades, it never displaces. */
  peakBlackPointsLoc: WebGLUniformLocation;
  /** The custom-shape table (see encodePeakShapeTexture), one row per shaped peak. Owned here rather
   * than rebuilt per draw because its contents only change when a peak's *shape* changes, which is a
   * rare authoring event -- unlike every other peak parameter, which a slider drag can change on
   * every frame. See peakShapeSignature. */
  peakShapeTexture: WebGLTexture;
  /** Which shapes the texture currently holds, as the ordered list of their paths. Mutable, and the
   * whole point: the encode-and-upload below is far too expensive for a per-frame path, so it runs
   * only when this stops matching what the frame is asking for. */
  peakShapeSignature: string;
  /** Whether the vertex stage can sample textures at all.
   *
   * WebGL1 permits MAX_VERTEX_TEXTURE_IMAGE_UNITS to be 0, and the vertex stage is where peakSwell
   * reads a shape to displace geometry by it. Rather than fail the whole mask on such hardware -- the
   * shape is an addition to a feature that works fine without it -- drawMaskMesh marks every peak as
   * a circle when this is false, which both stages then agree on. Shaped peaks come out round; nothing
   * tears, nothing renders wrong, and every unshaped peak is completely unaffected. */
  supportsVertexTextures: boolean;
  textureMixLoc: WebGLUniformLocation;
  textureLoc: WebGLUniformLocation;
  hasTextureLoc: WebGLUniformLocation;
  maskLoc: WebGLUniformLocation;
  maskActiveLoc: WebGLUniformLocation;
  glowColorLoc: WebGLUniformLocation;
}

/** Packs a frame's shaped peaks into the RGBA8 rows peakShapeAt reads: one row per shape, each
 * `samples` texels wide, RG carrying rho and BA carrying d(rho)/d(theta).
 *
 * Both values are 16-bit across a byte pair, in the one arrangement mediump can decode without
 * either overflowing or quantizing: the high byte holds the value scaled to 0-255 and truncated, the
 * low byte holds the remainder of that same scaling, so the decode is `high + low/255` and never
 * leaves 0-1. Reassembling as `high*256 + low` would be the obvious alternative and is wrong on
 * exactly the hardware the mediump annotations exist for -- mediump guarantees only 2^14 of range.
 *
 * rho is stored as-is (it is already in (0, 1]); the slope is biased into 0-1 across
 * +/-PEAK_SHAPE_SLOPE_RANGE, which is affine and therefore survives peakShapeAt's interpolation --
 * blending two biased slopes and decoding once gives the same answer as decoding both and blending,
 * so the shader is free to mix before it decodes.
 *
 * Unused rows are left as zeroes rather than filled with a flat circle: a peak with no shape never
 * reads the texture at all (its row index is negative), so their contents are unreachable.
 */
export function encodePeakShapeTexture(shapes: (PeakShape | undefined)[], samples: number, rows: number): Uint8Array {
  const data = new Uint8Array(samples * rows * 4);
  shapes.forEach((shape, row) => {
    if (!shape || row >= rows) return;
    for (let i = 0; i < samples; i++) {
      const offset = (row * samples + i) * 4;
      const rho = Math.min(Math.max(shape.rho[i] ?? 1, 0), 1);
      const slope = shape.rhoPrime[i] ?? 0;
      const biased = Math.min(Math.max(slope / PEAK_SHAPE_SLOPE_RANGE, -1), 1) * 0.5 + 0.5;
      const rhoScaled = rho * 255;
      const slopeScaled = biased * 255;
      data[offset] = Math.floor(rhoScaled);
      data[offset + 1] = Math.round((rhoScaled - Math.floor(rhoScaled)) * 255);
      data[offset + 2] = Math.floor(slopeScaled);
      data[offset + 3] = Math.round((slopeScaled - Math.floor(slopeScaled)) * 255);
    }
  });
  return data;
}

export function initGLState(canvas: HTMLCanvasElement): GLState | undefined {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false });
  if (!gl) return undefined;
  // Needed for the fragment shader's fwidth() calls (constant-pixel-width triangle stroke, see
  // LIGHT_SOURCE_SHADER's own comment on edge/STROKE_WIDTH_PX) -- WebGL1 only exposes derivative
  // functions once this extension is requested, and it has to happen before the shader that
  // references them compiles. Effectively universal on WebGL1 today (it's core, unextended, in
  // WebGL2); if a browser somehow lacks it, mask rendering bails out the same way it already does
  // for any other unsupported GL feature below.
  if (!gl.getExtension("OES_standard_derivatives")) return undefined;
  const program = createProgram(gl, LIGHT_SOURCE_SHADER);
  if (!program) return undefined;

  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const barycentricBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  const centroidBuffer = gl.createBuffer();
  const highlightBuffer = gl.createBuffer();
  if (!positionBuffer || !colorBuffer || !barycentricBuffer || !uvBuffer || !centroidBuffer || !highlightBuffer)
    return undefined;

  const positionLoc = gl.getAttribLocation(program, "a_position");
  const colorLoc = gl.getAttribLocation(program, "a_color");
  const barycentricLoc = gl.getAttribLocation(program, "a_barycentric");
  const uvLoc = gl.getAttribLocation(program, "a_uv");
  const centroidLoc = gl.getAttribLocation(program, "a_centroid");
  const highlightLoc = gl.getAttribLocation(program, "a_highlight");
  const peakShapeTexture = gl.createTexture();
  if (!peakShapeTexture) return undefined;
  gl.bindTexture(gl.TEXTURE_2D, peakShapeTexture);
  // NEAREST on both axes, deliberately. Vertically because each row is a different peak and any
  // blending between them would be meaningless; horizontally because the table is 16-bit stored as
  // byte pairs, which hardware filtering would corrupt at every low-byte wrap -- peakShapeAt blends
  // the decoded values itself instead. REPEAT on S is what makes theta = +pi wrap onto theta = -pi,
  // so the seam behaves like any other texel boundary; it is legal here only because the table's
  // width is a power of two.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
  const lightSourceCentersLoc = gl.getUniformLocation(program, "u_lightSourceCenters");
  const lightSourceRadiiLoc = gl.getUniformLocation(program, "u_lightSourceRadii");
  const lightSourceFalloffsLoc = gl.getUniformLocation(program, "u_lightSourceFalloffs");
  const lightSourceIntensitiesLoc = gl.getUniformLocation(program, "u_lightSourceIntensities");
  const lightSourceDarknessesLoc = gl.getUniformLocation(program, "u_lightSourceDarknesses");
  const lightSourceCountLoc = gl.getUniformLocation(program, "u_lightSourceCount");
  const peaksLoc = gl.getUniformLocation(program, "u_peaks");
  const peakFalloffsLoc = gl.getUniformLocation(program, "u_peakFalloffs");
  const peakCountLoc = gl.getUniformLocation(program, "u_peakCount");
  const peakShapesLoc = gl.getUniformLocation(program, "u_peakShapes");
  const peakShapeRowsLoc = gl.getUniformLocation(program, "u_peakShapeRows");
  const peakShapeSamplesLoc = gl.getUniformLocation(program, "u_peakShapeSamples");
  const peakBlackPointsLoc = gl.getUniformLocation(program, "u_peakBlackPoints");
  const textureMixLoc = gl.getUniformLocation(program, "u_textureMix");
  const textureLoc = gl.getUniformLocation(program, "u_texture");
  const hasTextureLoc = gl.getUniformLocation(program, "u_hasTexture");
  const maskLoc = gl.getUniformLocation(program, "u_mask");
  const maskActiveLoc = gl.getUniformLocation(program, "u_maskActive");
  const glowColorLoc = gl.getUniformLocation(program, "u_glowColor");
  if (
    positionLoc < 0 ||
    colorLoc < 0 ||
    barycentricLoc < 0 ||
    uvLoc < 0 ||
    centroidLoc < 0 ||
    highlightLoc < 0 ||
    !resolutionLoc ||
    !lightSourceCentersLoc ||
    !lightSourceRadiiLoc ||
    !lightSourceFalloffsLoc ||
    !lightSourceIntensitiesLoc ||
    !lightSourceDarknessesLoc ||
    !lightSourceCountLoc ||
    !peaksLoc ||
    !peakFalloffsLoc ||
    !peakCountLoc ||
    !peakShapesLoc ||
    !peakShapeRowsLoc ||
    !peakShapeSamplesLoc ||
    !peakBlackPointsLoc ||
    !textureMixLoc ||
    !textureLoc ||
    !hasTextureLoc ||
    !maskLoc ||
    !maskActiveLoc ||
    !glowColorLoc
  )
    return undefined;

  return {
    gl,
    program,
    positionBuffer,
    colorBuffer,
    barycentricBuffer,
    uvBuffer,
    centroidBuffer,
    highlightBuffer,
    positionLoc,
    colorLoc,
    barycentricLoc,
    uvLoc,
    centroidLoc,
    highlightLoc,
    resolutionLoc,
    lightSourceCentersLoc,
    lightSourceRadiiLoc,
    lightSourceFalloffsLoc,
    lightSourceIntensitiesLoc,
    lightSourceDarknessesLoc,
    lightSourceCountLoc,
    peaksLoc,
    peakFalloffsLoc,
    peakCountLoc,
    peakShapesLoc,
    peakShapeRowsLoc,
    peakShapeSamplesLoc,
    peakBlackPointsLoc,
    peakShapeTexture,
    // Starts empty rather than as a flat circle table, so the first frame carrying any shaped peak
    // uploads one and a project with no shaped peaks never uploads anything at all.
    peakShapeSignature: "",
    supportsVertexTextures: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0,
    textureMixLoc,
    textureLoc,
    hasTextureLoc,
    maskLoc,
    maskActiveLoc,
    glowColorLoc,
  };
}

export interface MaskLightSource {
  x: number;
  y: number;
  radius: number;
  falloff: number;
  intensity: number;
  darkness: number;
}

export interface DrawMaskMeshOptions {
  vertexCount: number;
  // One entry per simultaneously-animating light source (see project-mask-item.tsx's
  // playLightSourceAnimation) -- only entries with a positive radius are actually sent to the
  // shader (see drawMaskMesh below), and only the first MAX_MASK_LIGHT_SOURCES of those.
  lightSources: MaskLightSource[];
  // Every topology peak whose height field this frame should show, already merged with any edit
  // that's mid-flight to the server (see project-mask-item.tsx's resolvePeakUniforms -- the one
  // place this is assembled). Only peaks that can actually contribute are uploaded, and only the
  // first MAX_MASK_PEAKS of those; see drawMaskMesh below.
  //
  // This being a per-frame uniform rather than baked geometry is what makes a peak edit cheap: a
  // slider drag re-uploads five floats and redraws, with no buffer traffic and no re-tessellation,
  // so the live preview and the committed render are computed by identical code.
  peaks: PeakGeometryInput[];
  textureMix: number;
  // The source image, already uploaded as a GPU texture -- see loadImageTexture and
  // project-mask-item.tsx's own sourceImgSrc resolution. undefined whenever it hasn't loaded (yet,
  // or ever), in which case the shader falls back to each triangle's own flat baked-in color (see
  // u_hasTexture's own comment in the fragment shader).
  texture: WebGLTexture | undefined;
  maskTexture: WebGLTexture | undefined;
  glowColor: [number, number, number];
}

/**
 * Draws one frame of a masked mesh -- the uniform-setting and draw-call boilerplate shared by
 * every WebGL renderer in this file's family (the live streaming preview and the static,
 * already-complete one both feed the same shader the same way; they only differ in how the
 * buffers they draw get filled).
 */
export function drawMaskMesh(state: GLState, options: DrawMaskMeshOptions): void {
  const { gl } = state;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (options.vertexCount === 0) return;

  gl.useProgram(state.program);
  gl.uniform2f(state.resolutionLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);

  // Only lights with a positive radius count as active -- mirrors the old single-light
  // u_lightSourceActive gate, just decided client-side now instead of per-fragment, since an
  // inactive light contributes nothing the shader's loop needs to see at all.
  const activeLights = options.lightSources.filter((l) => l.radius > 0).slice(0, MAX_MASK_LIGHT_SOURCES);
  gl.uniform1i(state.lightSourceCountLoc, activeLights.length);
  if (activeLights.length > 0) {
    const centers = new Float32Array(activeLights.length * 2);
    const radii = new Float32Array(activeLights.length);
    const falloffs = new Float32Array(activeLights.length);
    const intensities = new Float32Array(activeLights.length);
    const darknesses = new Float32Array(activeLights.length);
    activeLights.forEach((light, i) => {
      centers[i * 2] = light.x;
      centers[i * 2 + 1] = light.y;
      radii[i] = Math.max(light.radius, 1);
      falloffs[i] = Math.max(light.falloff, 1);
      intensities[i] = light.intensity;
      darknesses[i] = light.darkness;
    });
    gl.uniform2fv(state.lightSourceCentersLoc, centers);
    gl.uniform1fv(state.lightSourceRadiiLoc, radii);
    gl.uniform1fv(state.lightSourceFalloffsLoc, falloffs);
    gl.uniform1fv(state.lightSourceIntensitiesLoc, intensities);
    gl.uniform1fv(state.lightSourceDarknessesLoc, darknesses);
  }

  // Mirrors the light block above exactly. Sorted by |elevation| before the MAX_MASK_PEAKS cut so
  // that when a mesh somehow carries more peaks than one draw call supports, the ones that survive
  // are the ones actually carrying the relief rather than whichever happened to be created first --
  // the light array's "silently drops the overflow" rule, but with the overflow chosen well.
  const activePeaks = options.peaks
    .filter(isActivePeak)
    .sort((a, b) => Math.abs(b.elevation) - Math.abs(a.elevation))
    .slice(0, MAX_MASK_PEAKS);
  gl.uniform1i(state.peakCountLoc, activePeaks.length);
  if (activePeaks.length > 0) {
    // xyzw = cx, cy, radius, elevation -- see u_peaks' own comment in PEAK_FIELD_GLSL.
    const peaks = new Float32Array(activePeaks.length * 4);
    const falloffs = new Float32Array(activePeaks.length);
    // rgba, in the same peak order -- a zeroed entry (which is what an absent black point becomes) is
    // read by the shader as "no black point" rather than as opaque black, since its alpha is the
    // weight the tint is applied at. See u_peakBlackPoints. Left unfilled past activePeaks.length for
    // the same reason the two arrays above are: the shader's loop breaks at u_peakCount, so nothing
    // beyond it is ever read.
    const blackPoints = new Float32Array(activePeaks.length * 4);
    activePeaks.forEach((peak, i) => {
      peaks[i * 4] = peak.cx;
      peaks[i * 4 + 1] = peak.cy;
      peaks[i * 4 + 2] = Math.max(peak.radius, 1);
      peaks[i * 4 + 3] = peak.elevation;
      // Floored at MIN_MASK_PEAK_FALLOFF rather than passed through: below 1 the profile's
      // derivative raises a near-zero base to a negative exponent (see peakProfile), and a document
      // stored before that bound existed can still carry such a value.
      falloffs[i] = Math.max(peak.falloff, MIN_MASK_PEAK_FALLOFF);
      blackPoints[i * 4] = peak.blackPoint?.r ?? 0;
      blackPoints[i * 4 + 1] = peak.blackPoint?.g ?? 0;
      blackPoints[i * 4 + 2] = peak.blackPoint?.b ?? 0;
      blackPoints[i * 4 + 3] = peak.blackPoint?.a ?? 0;
    });
    gl.uniform4fv(state.peaksLoc, peaks);
    gl.uniform1fv(state.peakFalloffsLoc, falloffs);
    gl.uniform4fv(state.peakBlackPointsLoc, blackPoints);
  }

  // The shape table. Every peak defaults to the circle sentinel, so an unshaped mesh -- which is
  // every mesh until someone authors a shape -- pays for exactly one uniform array upload here and
  // never touches the texture at all.
  const shapeRows = new Float32Array(MAX_MASK_PEAKS).fill(-1);
  const shapes = activePeaks.map((peak) => peak.shape);
  // Dropped wholesale where the vertex stage cannot sample -- see GLState.supportsVertexTextures.
  // Both stages read the same u_peakShapeRows, so this degrades a shaped peak to the circle it
  // generalizes in the displacement and the shading together, rather than letting them disagree.
  const usableShapes = state.supportsVertexTextures ? shapes : shapes.map(() => undefined);
  const samples = usableShapes.find((shape) => shape !== undefined)?.rho.length;
  if (samples !== undefined) {
    usableShapes.forEach((shape, i) => {
      if (shape) shapeRows[i] = i;
    });
    // Re-encoded only when the set of shapes actually changes. A peak's geometry is edited on every
    // frame of a slider drag, but its *shape* is picked once at authoring time -- so keying on the
    // paths keeps a full encode-and-upload off the drag path entirely.
    const signature = usableShapes.map((shape) => shape?.path ?? "").join("|");
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.peakShapeTexture);
    if (signature !== state.peakShapeSignature) {
      // Rows go up in the order encodePeakShapeTexture wrote them, which takes an explicit opt-out:
      // UNPACK_FLIP_Y_WEBGL is context-wide sticky state, both image uploads in this module turn it
      // on (see buildMaskTexture and loadImageTexture, where flipping is correct -- image rows are
      // top-first and the UVs are not), and neither turns it back off. It applies to ArrayBufferView
      // uploads exactly as it does to DOM ones, so inheriting it here would land peak i's samples on
      // row MAX_MASK_PEAKS - 1 - i and hand every shaped peak an all-zero row instead -- which
      // peakShapeAt floors to PEAK_SHAPE_MIN_RHO, collapsing the peak to 5% of its radius rather
      // than failing in any way that looks like a texture problem.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        samples,
        MAX_MASK_PEAKS,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        encodePeakShapeTexture(usableShapes, samples, MAX_MASK_PEAKS),
      );
      state.peakShapeSignature = signature;
    }
    gl.uniform1i(state.peakShapesLoc, 2);
    gl.uniform1f(state.peakShapeSamplesLoc, samples);
  }
  gl.uniform1fv(state.peakShapeRowsLoc, shapeRows);

  gl.uniform1f(state.textureMixLoc, options.textureMix);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, options.texture ?? null);
  gl.uniform1i(state.textureLoc, 0);
  gl.uniform1f(state.hasTextureLoc, options.texture ? 1 : 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, options.maskTexture ?? null);
  gl.uniform1i(state.maskLoc, 1);
  gl.uniform1f(state.maskActiveLoc, options.maskTexture ? 1 : 0);
  gl.uniform3fv(state.glowColorLoc, options.glowColor);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
  gl.enableVertexAttribArray(state.positionLoc);
  gl.vertexAttribPointer(state.positionLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
  gl.enableVertexAttribArray(state.colorLoc);
  gl.vertexAttribPointer(state.colorLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.barycentricBuffer);
  gl.enableVertexAttribArray(state.barycentricLoc);
  gl.vertexAttribPointer(state.barycentricLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.uvBuffer);
  gl.enableVertexAttribArray(state.uvLoc);
  gl.vertexAttribPointer(state.uvLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.centroidBuffer);
  gl.enableVertexAttribArray(state.centroidLoc);
  gl.vertexAttribPointer(state.centroidLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.highlightBuffer);
  gl.enableVertexAttribArray(state.highlightLoc);
  gl.vertexAttribPointer(state.highlightLoc, 1, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, options.vertexCount);
}

// Reading getComputedStyle-style colors ("shaded" is any CSS color the server feels like emitting) is
// only reliable via a 1x1 2d canvas round-trip -- it's the one place the browser will parse arbitrary
// CSS color syntax for us instead of hand-rolling a parser for rgb()/hex/named colors.
export function colorToRGB01(ctx: CanvasRenderingContext2D, color: string): [number, number, number] {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0] / 255, data[1] / 255, data[2] / 255];
}

/**
 * Rasterize the silhouette curves, and the glow outside them, into the mask
 * texture the fragment shader reads -- the WebGL stand-in for ctx.clip(),
 * which has no GL equivalent.
 *
 * Filling on a 2d context rather than tessellating the Beziers into GL
 * geometry is deliberate: Path2D already understands cubic path data and the
 * nonzero winding rule that makes each curve's holes punch through, and its
 * fill is antialiased, so the clipped edge lands smooth for free. The mask is
 * only rebuilt when a curve arrives (a handful of times per image), so the 2d
 * round-trip never touches the per-frame path.
 *
 * The glow is drawn as concentric strokes, widest first, one per measured
 * band. A stroke is centred on its path, so half-width `offset` reaches
 * exactly that far out and the solid fill afterwards covers the half that
 * fell inward. Strokes rather than a shadowBlur because the measured falloff
 * is not Gaussian -- it drops far faster right at the edge than any blur
 * does, and shadowBlur would render it as a flat haze.
 *
 * Red marks glow and black marks subject, giving the shader its .r channel.
 * Hue survives the un-premultiply on upload even where alpha is tiny, which a
 * brightness ramp would not.
 */
export function uploadCurveMask(
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement,
  curves: { d: string; glow: { offset: number; opacity: number }[] }[],
  existing: WebGLTexture | undefined,
): WebGLTexture | undefined {
  const ctx = canvas.getContext("2d");
  if (!ctx) return existing;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Round joins: at these stroke widths a default miter would throw long
  // spikes off every corner of the outline.
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ff0000";

  for (const curve of curves) {
    const path = new Path2D(curve.d);
    let covered = 0;
    for (const stop of [...curve.glow].sort((a, b) => b.offset - a.offset)) {
      // Each stroke lands on top of the wider ones already drawn, so painting
      // this band's opacity directly would stack on what's underneath and run
      // the falloff dark. Solve instead for the alpha that takes the
      // accumulated coverage from where it is to where this band wants it.
      const alpha = (stop.opacity - covered) / (1 - covered);
      if (!(alpha > 0)) continue;
      ctx.globalAlpha = Math.min(alpha, 1);
      ctx.lineWidth = stop.offset * 2;
      ctx.stroke(path);
      covered = stop.opacity;
    }
  }

  ctx.globalAlpha = 1;
  // Opaque black over the top: full coverage for the subject, and .r back to
  // 0 so the shader stops treating it as glow.
  ctx.fillStyle = "#000000";
  for (const curve of curves) ctx.fill(new Path2D(curve.d));

  const texture = existing ?? gl.createTexture();
  if (!texture) return undefined;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Same y-flip as the source-image texture, so the mask lines up with the
  // UVs the mesh's vertices already carry. Un-premultiplied on purpose: the
  // shader reads .r as a ratio independent of .a, which only holds if the
  // colour hasn't been scaled by alpha.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  // LINEAR + CLAMP_TO_EDGE and no mipmaps: required for a non-power-of-two
  // texture in WebGL1, which an arbitrary image size usually is.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

/**
 * Loads src as an HTMLImageElement and uploads it as a WebGL texture -- the u_texture endpoint
 * Maskbar's texture slider blends toward at 0 (see u_hasTexture's own comment in the fragment
 * shader). Async; onLoaded fires once the upload completes, onError if the image itself fails to
 * load (network, cross-origin, decode).
 */
export function loadImageTexture(
  gl: WebGLRenderingContext,
  src: string,
  onLoaded: (texture: WebGLTexture) => void,
  onError?: (error: unknown) => void,
): void {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => {
    try {
      const texture = gl.createTexture();
      if (!texture) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Image rows come in top-first (DOM convention); flipping here makes v=1 land on the
      // image's top row, matching the vertex shader's own y-flip for gl_Position.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      onLoaded(texture);
    } catch (error) {
      onError?.(error);
    }
  };
  image.onerror = (error) => {
    onError?.(error);
  };
  image.src = src;
}

// Pulls the vertex coordinates back out of a path's `d` string ("M x,y L x,y L x,y Z") --
// PolygonPath_V1_0 (the persisted, post-mask format) only keeps `d`, unlike the live
// streaming MaskTriangle_V1_0 which also carries a raw `points` array alongside it.
export function parsePathPoints(d: string): [number, number][] {
  const points: [number, number][] = [];
  const re = /(-?\d*\.?\d+(?:e[-+]?\d+)?)[,\s]+(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d))) {
    points.push([parseFloat(match[1]), parseFloat(match[2])]);
  }
  return points;
}

// Coarse enough to absorb the kind of hairline floating-point mismatch two triangles' own,
// independently parsed copies of what's meant to be one shared mesh corner can carry (see
// weldPoints below), far below anything a real, intentionally distinct vertex would ever land
// within -- a mesh this fine (sub-tenth-of-a-pixel triangles) isn't a real triangulation this
// feature ever produces.
const WELD_EPSILON_PX = 0.1;

// buildStaticMaskMesh gives every polygon its own private copy of each of its corner points --
// there's no shared/indexed vertex buffer, so two triangles that are meant to share an edge each
// carry their own independently parsed (x, y) for that corner. Snapping every point to the first
// canonical (x, y) seen within WELD_EPSILON_PX of it (mutating in place) collapses those duplicates
// into a single shared array *reference*.
//
// What that shared reference is for has changed, and the distinction matters if you're deciding
// whether this function still earns its keep. It used to be the crack-free guarantee itself: the
// displacement was applied on the CPU by mutating points in place, so two hairline-mismatched copies
// of one corner would be pushed to visibly different places, and welding was what stopped a peak
// from tearing the mesh open. That job is gone -- the displacement is now a pure function of
// a_position evaluated per-vertex on the GPU (see peakSwell), so even two un-welded copies of a
// corner map to the same output to within their own 1e-6 mismatch, and cracks are impossible by
// construction rather than by maintenance.
//
// What welding is still for is *identity*: computeEdgeSubdivisionCounts memoizes one subdivision
// count per edge, keyed by its endpoints' identities (see pointId), and two triangles can only be
// guaranteed to look up the same entry -- and so agree on how many vertices sit along the edge they
// share -- if their copies of that edge's endpoints are literally the same objects. That guarantee
// is still load-bearing, so this still runs.
function weldPoints(pointGroups: [number, number][][]): void {
  const canonical = new Map<string, [number, number]>();
  for (const points of pointGroups) {
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      const key = `${Math.round(x / WELD_EPSILON_PX)},${Math.round(y / WELD_EPSILON_PX)}`;
      const existing = canonical.get(key);
      if (existing) {
        points[i] = existing;
      } else {
        canonical.set(key, points[i]);
      }
    }
  }
}

/** Parses and welds a mask's own polygons (and, if it has curves, the backing quad's corners) into
 * the point groups buildStaticMaskMesh assembles into its own position/uv/centroid buffers --
 * every triangle's own corners are parsed independently, so two triangles meant to share an edge
 * can each end up with a hairline-mismatched copy of that corner; welding collapses those into one
 * shared reference (see weldPoints' own comment for what that identity is still load-bearing for).
 */
export function buildWeldedMaskPointGroups(maskData: {
  width: number;
  height: number;
  polygons: { d: string }[];
  curves: { d: string }[];
}): {
  corners: [number, number][];
  polygonPointSets: [number, number][][];
} {
  // A backing quad under the mesh, trimmed to the silhouette by the curve mask (see
  // uploadCurveMask) -- without it, the sliver between the mesh's straight boundary chords and
  // the smooth curve it's inscribed in would read as a transparent fringe around the shape.
  const corners: [number, number][] =
    maskData.curves.length > 0
      ? [
          [0, 0],
          [maskData.width, 0],
          [0, maskData.height],
          [maskData.width, 0],
          [maskData.width, maskData.height],
          [0, maskData.height],
        ]
      : [];
  const polygonPointSets = maskData.polygons.map((polygon) => parsePathPoints(polygon.d));
  // Every triangle's own corners are parsed independently above, so two triangles meant to share
  // an edge can each end up with a hairline-mismatched copy of that corner -- see weldPoints' own
  // comment for what the resulting shared identity buys. Welded across the backing quad's corners
  // too, in case a peak's radius ever reaches the mesh's own image-boundary edge.
  weldPoints([corners, ...polygonPointSets]);
  return { corners, polygonPointSets };
}

/** The subset of buildStaticMaskMesh's own output that depends purely on point position -- not
 * fill color. Vertex layout mirrors buildStaticMaskMesh exactly: an optional 6-vertex backing
 * quad, then one entry per corners's/polygonPointSets's own points.
 */
function assembleMaskMeshPositions(
  maskData: { width: number; height: number },
  corners: [number, number][],
  polygonPointSets: [number, number][][],
): { positions: number[]; uvs: number[]; centroids: number[] } {
  const positions: number[] = [];
  const uvs: number[] = [];
  const centroids: number[] = [];

  // See buildStaticMaskMesh's own comment on this loop for why each corner carries its own
  // position as its centroid rather than one shared value.
  for (const [x, y] of corners) {
    positions.push(x, y);
    uvs.push(x / maskData.width, 1 - y / maskData.height);
    centroids.push(x, y);
  }

  polygonPointSets.forEach((points) => {
    const centroid: [number, number] = [
      points.reduce((sum, [x]) => sum + x, 0) / points.length,
      points.reduce((sum, [, y]) => sum + y, 0) / points.length,
    ];
    for (const [x, y] of points) {
      positions.push(x, y);
      uvs.push(x / maskData.width, 1 - y / maskData.height);
      centroids.push(...centroid);
    }
  });

  return { positions, uvs, centroids };
}

/** One peak's worth of height-field parameters -- mirrors mask.peaks' own
 * cx/cy/radius/elevation/falloff (Peak_V1_0, workspace.server.ts) minus the id, so callers can pass
 * a mask's own peaks straight through with no reshaping. The shape consumed by both things that read
 * a peak now: the uniform upload in drawMaskMesh, and the subdivision budget below. */
export interface PeakGeometryInput {
  cx: number;
  cy: number;
  radius: number;
  elevation: number;
  falloff: number;
  /** This peak's custom silhouette, or undefined for a circle -- which is the overwhelmingly common
   * case and the one that must stay free, so every consumer treats undefined as "rho is 1 everywhere"
   * rather than materialising a flat table for it. `radius` above is then the shape's furthest reach
   * rather than its only one (see peakShapeAt in the shared kernel). Type-only, so this module keeps
   * its no-runtime-imports promise (see line 1). */
  shape?: PeakShape;
  /** This peak's own black point, or undefined for none -- the colour the mask's lights drive this
   * peak's shading toward instead of black, weighted by the peak's own profile (see peakBlackPoint
   * in the fragment shader). Undefined and an alpha of 0 mean the same thing to every consumer, so
   * a peak that has never had one costs nothing beyond its slot in the uniform array. */
  blackPoint?: PeakBlackPoint_V1_0;
}

/** Whether a peak can affect anything at all. Zero elevation contributes nothing to the height field
 * (so nothing to displace and nothing to shade), and a non-positive radius is degenerate rather than
 * small (the field divides by it). The single predicate for "worth uploading / worth subdividing
 * for", so the shader's loop bound and the CPU's triangle budget can't disagree about which peaks
 * count. */
export function isActivePeak(peak: PeakGeometryInput): boolean {
  return peak.radius > 0 && peak.elevation !== 0;
}

/** TypeScript twin of the shared kernel's own peakProfile height term, `k(u) = (1 - u^2)^falloff`.
 *
 * The critical thing to understand about this and peakSwellAt below: **neither is ever used to move
 * a point.** The displacement has exactly one implementation, the GLSL one, and it runs on the GPU.
 * These exist only to *measure* how much the GPU is about to bend an edge, so the subdivision pass
 * can budget vertices for it (see edgeSubdivisionCount). That bounds the consequence of these ever
 * drifting from the GLSL to "a slightly wrong triangle count" -- never a visual mismatch, never a
 * crack -- which is what makes duplicating the math here acceptable at all. If you change the
 * profile, change it in PEAK_FIELD_GLSL first and mirror it here second.
 */
export function peakProfileK(u: number, falloff: number): number {
  const s = Math.max(1 - u * u, 0);
  return Math.pow(Math.max(s, 1e-4), falloff);
}

/** TypeScript twin of the shared kernel's own peakShapeAt, reduced to the one channel the CPU side
 * needs: a shape's normalized reach in the direction `theta`, or 1 for a circle.
 *
 * Lives here beside the other twins rather than in canvas-media/peak-shape.ts, where the table it
 * reads is produced, for the reason stated on line 1 -- a real import there would cost this module
 * its loadability under bare type stripping, and with it peak-field.test.ts. What it duplicates is
 * only the *lookup* (the same nearest-texel pair, the same linear blend between them, the same wrap
 * at +/-pi), never the sampling, so the two cannot disagree about what a shape is -- only, at worst,
 * about how finely it is read between two stored samples.
 *
 * Same measurement-only status as peakProfileK and peakSwellAt below: nothing here ever moves a
 * point. */
export function peakShapeRhoAt(shape: PeakShape | undefined, theta: number): number {
  if (!shape) return 1;
  const samples = shape.rho.length;
  const t = ((theta + Math.PI) / (2 * Math.PI)) * samples;
  const index = Math.floor(t);
  const lower = shape.rho[((index % samples) + samples) % samples];
  const upper = shape.rho[(((index + 1) % samples) + samples) % samples];
  // The same floor the kernel applies (see PEAK_SHAPE_MIN_RHO), so the triangle budget is measured
  // against the reach the GPU will actually use rather than a smaller one this side alone believes in.
  return Math.max(lower + (upper - lower) * (t - index), PEAK_SHAPE_MIN_RHO);
}

/** TypeScript twin of the shared kernel's own peakSwell -- the in-plane displacement the vertex stage
 * applies at `point`. Measurement only; see peakProfileK's own comment. */
export function peakSwellAt(point: [number, number], peaks: PeakGeometryInput[]): [number, number] {
  let dx = 0;
  let dy = 0;
  for (const peak of peaks) {
    const toPointX = point[0] - peak.cx;
    const toPointY = point[1] - peak.cy;
    const dist = Math.hypot(toPointX, toPointY);
    // The peak's reach in this point's own direction, which for a circle is just its radius. Note
    // this is the LOCAL radius, matching the kernel -- see peakSwell's own comment there for why the
    // pixel bound survives the substitution with no rho left in it.
    //
    // The unshaped case skips the atan2 rather than passing it to a lookup that would discard it, and
    // that branch is worth more than it looks: this function is the whole subdivision pass's inner
    // loop (edgeSwellSag samples it five times per edge, for every edge of a mesh carrying thousands
    // of triangles, once per peak), so an atan2 computed for every circular peak would be a real cost
    // paid on every mesh in the project to support a feature almost none of them use.
    const radius = peak.shape
      ? peak.radius * peakShapeRhoAt(peak.shape, dist > 1e-4 ? Math.atan2(toPointY, toPointX) : 0)
      : peak.radius;
    const u = dist / radius;
    if (u >= 1) continue;
    const height = peak.elevation * peakProfileK(u, Math.max(peak.falloff, MIN_MASK_PEAK_FALLOFF));
    const coefficient = Math.min(
      Math.max((MASK_PEAK_SWELL * height) / peak.radius, -MASK_PEAK_SWELL_LIMIT),
      MASK_PEAK_SWELL_LIMIT,
    );
    dx += coefficient * toPointX;
    dy += coefficient * toPointY;
  }
  return [dx, dy];
}

// Ceiling on how many extra points one edge can be given -- the knob for "how smooth a
// fully-elevated peak's own tip looks." Purely a rendering-cost budget, not a correctness constant
// like WELD_EPSILON_PX: a triangle with n points per edge fans into 3(n + 1) triangles, so 6 is 21
// at the very worst and only for triangles actually inside a peak's radius. Raise it for a smoother
// dome at the cost of more triangles.
const MAX_EDGE_SUBDIVISION_POINTS = 6;

/** How far the straight line between two displaced endpoints misses where the GPU will actually put
 * the edge -- the sag that subdivision exists to remove.
 *
 * Sampled at three interior parameters rather than just the midpoint, because a second difference
 * taken at the midpoint alone is blind to a symmetric bump: an edge whose two endpoints sit outside a
 * peak and whose midpoint lands exactly on its epicenter has zero displacement at all three of those
 * points, and would be scored as perfectly straight while being precisely the edge most in need of
 * refinement.
 *
 * A pure function of the edge's own two endpoints, which is what keeps computeEdgeSubdivisionCounts'
 * per-edge memoization a real crack-free guarantee: whichever of the two triangles sharing an edge
 * asks first, the answer is the same. Order-independent too, since the sample set {0.25, 0.5, 0.75}
 * is symmetric, so swapping a and b cannot change the count.
 */
function edgeSwellSag(a: [number, number], b: [number, number], peaks: PeakGeometryInput[]): number {
  const swellA = peakSwellAt(a, peaks);
  const swellB = peakSwellAt(b, peaks);
  let worst = 0;
  for (const t of [0.25, 0.5, 0.75]) {
    const at: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const swellAt = peakSwellAt(at, peaks);
    worst = Math.max(
      worst,
      Math.hypot(
        swellA[0] + (swellB[0] - swellA[0]) * t - swellAt[0],
        swellA[1] + (swellB[1] - swellA[1]) * t - swellAt[1],
      ),
    );
  }
  return worst;
}

/** How many extra points a given edge needs inserted along it, measured from the field itself rather
 * than guessed from proximity.
 *
 * A piecewise-linear approximation's error falls as 1/m^2 in the number of segments m, so bringing a
 * measured sag under tolerance takes m = ceil(sqrt(sag / tolerance)) segments -- which is a budget,
 * not a taper, and that distinction is the point. The previous heuristic tapered linearly from the
 * epicenter to the rim, which was wrong in two ways at once now that the field has a real apex: it
 * spent its whole budget *at* the epicenter, where the swell is identically zero, and dropped to
 * nothing *at* the rim, where a low falloff has its steepest slope. With falloff a free parameter,
 * distance to the epicenter no longer predicts curvature at all.
 *
 * Driving it off edgeSwellSag instead means it tracks every parameter for free: elevation (a flat
 * peak asks for nothing, and a dent is budgeted exactly like the bump it mirrors), radius, and
 * falloff (a needle gets its points where its curvature actually is).
 */
function edgeSubdivisionCount(a: [number, number], b: [number, number], peaks: PeakGeometryInput[]): number {
  const sag = edgeSwellSag(a, b, peaks);
  if (!(sag > PEAK_SUBDIVISION_TOLERANCE_PX)) return 0;
  return Math.min(Math.ceil(Math.sqrt(sag / PEAK_SUBDIVISION_TOLERANCE_PX)) - 1, MAX_EDGE_SUBDIVISION_POINTS);
}

// n evenly spaced points strictly between a and b (n=0 -> none) -- a pure function of the edge's
// own two endpoints, so whichever of the (up to two) triangles sharing an edge calls this gets
// the same points; computeEdgeSubdivisionCounts below calls it exactly once per edge regardless,
// which is the real guarantee (see its own comment), this determinism is just what makes that
// guarantee not depend on call order too.
function pointsAlongEdge(a: [number, number], b: [number, number], n: number): [number, number][] {
  const points: [number, number][] = [];
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return points;
}

// Assigns every unique point a stable small integer so an edge (a pair of points) can be used as
// a plain string Map key regardless of which of its two triangles is asking -- edgeKey below
// sorts the pair so direction never matters either.
function pointId(point: [number, number], ids: Map<[number, number], number>): number {
  let id = ids.get(point);
  if (id === undefined) {
    id = ids.size;
    ids.set(point, id);
  }
  return id;
}

function edgeKey(idA: number, idB: number): string {
  return idA < idB ? `${idA},${idB}` : `${idB},${idA}`;
}

// Computes edgeSubdivisionCount exactly once per edge (keyed by its own two welded endpoints, not
// by which triangle asked) -- the actual crack-free guarantee: two triangles sharing an edge
// always look up the identical entry here, so boundaryLoopForTriangle below can never disagree
// with its neighbor about how many points sit along their shared edge, no matter how differently
// "close to a peak" the two triangles' own far corners are.
function computeEdgeSubdivisionCounts(
  triangles: [number, number][][],
  peaks: PeakGeometryInput[],
): { ids: Map<[number, number], number>; counts: Map<string, number> } {
  const ids = new Map<[number, number], number>();
  const counts = new Map<string, number>();
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];
  for (const tri of triangles) {
    for (const [i, j] of edges) {
      const a = tri[i];
      const b = tri[j];
      const key = edgeKey(pointId(a, ids), pointId(b, ids));
      if (!counts.has(key)) counts.set(key, edgeSubdivisionCount(a, b, peaks));
    }
  }
  return { ids, counts };
}

// The boundary of one triangle, walked corner-to-corner, with whatever points
// computeEdgeSubdivisionCounts assigned each of its 3 edges spliced in along the way -- every
// inserted point sits exactly on the original straight edge (plain linear interpolation), so this
// loop is always convex/star-shaped from any of the original 3 corners regardless of how many
// points ended up on each side, which is what makes fanTriangulate below always valid.
function boundaryLoopForTriangle(
  tri: [number, number][],
  ids: Map<[number, number], number>,
  counts: Map<string, number>,
): [number, number][] {
  const [a, b, c] = tri;
  const loop: [number, number][] = [];
  for (const [p, q] of [
    [a, b],
    [b, c],
    [c, a],
  ] as [number, number][][]) {
    loop.push(p);
    const n = counts.get(edgeKey(pointId(p, ids), pointId(q, ids))) ?? 0;
    if (n > 0) loop.push(...pointsAlongEdge(p, q, n));
  }
  return loop;
}

// Whether `point` lies strictly inside the triangle `tri`, by the sign of the three edge cross
// products. The epsilon is what makes "strictly" mean it: a point exactly on an edge (or close
// enough to be indistinguishable) is rejected, which matters because such a point could be shared
// with the neighbouring triangle across that edge and so wouldn't have the not-shared property
// fanTriangulate's anchor depends on.
function isStrictlyInsideTriangle(point: [number, number], tri: [number, number][]): boolean {
  const [a, b, c] = tri;
  const cross = (p: [number, number], q: [number, number]): number =>
    (q[0] - p[0]) * (point[1] - p[1]) - (q[1] - p[1]) * (point[0] - p[0]);
  const ab = cross(a, b);
  const bc = cross(b, c);
  const ca = cross(c, a);
  const epsilon = 1e-6;
  return (ab > epsilon && bc > epsilon && ca > epsilon) || (ab < -epsilon && bc < -epsilon && ca < -epsilon);
}

// Fans a (possibly boundary-refined) triangle from a fresh interior point -- with 0 inserted points
// this is just [tri] back out unchanged (no extra point is even created, so an
// untouched-far-from-any-peak triangle costs nothing extra). Fanning from a fresh *interior* point
// rather than one of the original 3 corners is deliberate, not cosmetic: such a point is never
// shared with any other triangle (unlike a corner, which can be the shared anchor of several
// triangles meeting at that same point), so there's no way for two different triangles' fans to
// ever produce the same degenerate sliver. Fanning from a corner instead was tried and rejected --
// whenever that corner's own two incident edges (not just the one opposite it) also had points
// inserted along them, the corner ended up colinear with its own inserted points, producing
// zero-area triangles there; when a mesh vertex was shared as the fan anchor by more than one
// original triangle, those different triangles' own degenerate slivers could coincide, breaking
// the "every edge shared by at most 2 triangles" guarantee this whole scheme exists for. A fresh
// interior point can't be colinear with 2 adjacent boundary points of a genuine (non-zero-area)
// triangle, so this never happens. Never self-intersects undisplaced (see boundaryLoopForTriangle's
// own comment on convexity, which a center fan of a convex polygon always triangulates validly);
// once the GPU displaces it, it can fold the same way an un-subdivided triangle already can at high
// elevation (see peakSwell) -- an accepted tradeoff, not new risk this introduces.
//
// Which interior point, though, is not arbitrary. A peak's own epicenter, when it falls strictly
// inside this triangle, has exactly the same never-shared property the centroid has *and* is where
// the height field has its apex -- and boundary refinement plus a centroid fan can otherwise never
// put a vertex at a peak's tip when one coarse triangle spans the whole peak, which is precisely the
// case where the dome most needs one. So an interior epicenter wins the anchor, largest |elevation|
// first (tie broken by input order, which is peak id, so the choice is deterministic); the centroid
// is the fallback when no epicenter qualifies.
function fanTriangulate(
  loop: [number, number][],
  tri: [number, number][],
  peaks: PeakGeometryInput[],
): [number, number][][] {
  if (loop.length === 3) return [[loop[0], loop[1], loop[2]]];

  let anchor: [number, number] | undefined;
  let bestElevation = 0;
  for (const peak of peaks) {
    const epicenter: [number, number] = [peak.cx, peak.cy];
    if (Math.abs(peak.elevation) <= bestElevation) continue;
    if (!isStrictlyInsideTriangle(epicenter, tri)) continue;
    anchor = epicenter;
    bestElevation = Math.abs(peak.elevation);
  }
  const center: [number, number] = anchor ?? [
    loop.reduce((sum, [x]) => sum + x, 0) / loop.length,
    loop.reduce((sum, [, y]) => sum + y, 0) / loop.length,
  ];

  const triangles: [number, number][][] = [];
  for (let i = 0; i < loop.length; i++) {
    triangles.push([center, loop[i], loop[(i + 1) % loop.length]]);
  }
  return triangles;
}

/** Replaces every triangle in `triangles` with 1 or more finer ones near an active peak's own
 * epicenter (see edgeSubdivisionCount/boundaryLoopForTriangle/fanTriangulate above), leaving
 * triangles outside every peak's radius untouched (1-for-1). `outputCounts[i]` is how many output
 * triangles `triangles[i]` expanded into, in the same order they were appended to `outputTriangles`
 * -- so a caller that needs to know which output triangles came from which input one can
 * reconstruct that purely from a running sum, without outputTriangles carrying any metadata of its
 * own (see buildStaticMaskMesh's own vertexRanges). */
function subdivideForPeaks(
  triangles: [number, number][][],
  peaks: PeakGeometryInput[],
): { outputTriangles: [number, number][][]; outputCounts: number[] } {
  const { ids, counts } = computeEdgeSubdivisionCounts(triangles, peaks);
  const outputTriangles: [number, number][][] = [];
  const outputCounts: number[] = [];
  for (const tri of triangles) {
    const fanned = fanTriangulate(boundaryLoopForTriangle(tri, ids, counts), tri, peaks);
    outputTriangles.push(...fanned);
    outputCounts.push(fanned.length);
  }
  return { outputTriangles, outputCounts };
}

/** The mesh's whole remaining CPU-side peak pipeline: adds finer geometry near any active peak so the
 * GPU's displacement has something to bend. Nothing here moves a point -- the displacement lives
 * exclusively in the vertex shader (see PEAK_FIELD_GLSL), and this pass only decides where vertices
 * go, which is topology and therefore inherently CPU work.
 *
 * `corners`/`polygonPointSets` are expected already welded (buildWeldedMaskPointGroups) -- `corners`
 * is processed 3-points-at-a-time as triangles the same way polygonPointSets already is (mirroring
 * how assembleMaskMeshPositions treats it), so a backing quad's own 2 triangles get refined exactly
 * like any other triangle near a peak, keeping the mesh's boundary conforming to whatever a peak
 * sitting near an image edge does to the polygons right next to it. Returns `polygonOutputCounts`
 * mirroring subdivideForPeaks' own `outputCounts`, but only for `polygonPointSets`' own entries (the
 * corners' portion is folded back into the flat `corners` array, not exposed).
 *
 * Note what is *no longer* here: this used to re-weld the subdivided output before warping it, purely
 * so the in-place warp couldn't be applied twice to a point two triangles shared. With the
 * displacement now a pure function of position evaluated per-vertex on the GPU, applying it "twice"
 * is meaningless -- every copy of a shared point maps to the same output regardless -- so that step
 * had nothing left to protect.
 */
export function subdivideMeshForPeaks(
  corners: [number, number][],
  polygonPointSets: [number, number][][],
  peaks: PeakGeometryInput[],
): {
  corners: [number, number][];
  polygonPointSets: [number, number][][];
  polygonOutputCounts: number[];
} {
  const active = peaks.filter(isActivePeak);
  if (active.length === 0) {
    return { corners, polygonPointSets, polygonOutputCounts: polygonPointSets.map(() => 1) };
  }

  const cornerTriangles: [number, number][][] = [];
  for (let i = 0; i + 3 <= corners.length; i += 3) cornerTriangles.push(corners.slice(i, i + 3));

  const { outputTriangles, outputCounts } = subdivideForPeaks([...cornerTriangles, ...polygonPointSets], active);

  const cornerOutputCount = outputCounts.slice(0, cornerTriangles.length).reduce((sum, n) => sum + n, 0);
  return {
    corners: outputTriangles.slice(0, cornerOutputCount).flat(),
    polygonPointSets: outputTriangles.slice(cornerOutputCount),
    polygonOutputCounts: outputCounts.slice(cornerTriangles.length),
  };
}

/**
 * Builds the static position/color/barycentric/uv buffers for an already-complete mask
 * result (see ProjectMaskItem's "static" source in draggables/project-mask-item.tsx) -- the persisted
 * counterpart to that same component's "live" source, which builds the buffers incrementally as
 * curves/triangles stream in instead. Since the whole mesh is in hand up front here, it's built
 * once rather than incrementally.
 */
export function buildStaticMaskMesh(
  maskData: {
    width: number;
    height: number;
    polygons: { d: string; fill: string }[];
    curves: { d: string; fill: string }[];
    peaks: PeakGeometryInput[];
  },
  colorCtx: CanvasRenderingContext2D,
): {
  positions: number[];
  colors: number[];
  barycentrics: number[];
  uvs: number[];
  centroids: number[];
  vertexCount: number;
  // One entry per maskData.polygons, in the same order -- [startVertex, vertexCount] into
  // `positions`/`colors`/etc. above. With no active peak this is just [quadVertexCount + i*3, 3]
  // for every i (the old fixed layout recolorHighlight, project-mask-item.tsx, used to assume
  // directly); once subdivideMeshForPeaks has expanded some polygons into more than one
  // triangle, this is the only reliable way to find a given polygon's own vertices.
  vertexRanges: [number, number][];
} {
  const built = buildWeldedMaskPointGroups(maskData);
  let corners = built.corners;
  let polygonPointSets = built.polygonPointSets;
  let polygonOutputCounts = polygonPointSets.map(() => 1);

  if (maskData.peaks.some(isActivePeak)) {
    const subdivided = subdivideMeshForPeaks(corners, polygonPointSets, maskData.peaks);
    corners = subdivided.corners;
    polygonPointSets = subdivided.polygonPointSets;
    polygonOutputCounts = subdivided.polygonOutputCounts;
  }

  const { positions, uvs, centroids } = assembleMaskMeshPositions(maskData, corners, polygonPointSets);
  const colors: number[] = [];
  const barycentrics: number[] = [];

  if (maskData.curves.length > 0) {
    const [r, g, b] = colorToRGB01(colorCtx, maskData.curves[0].fill);
    for (let i = 0; i < corners.length; i++) {
      colors.push(r, g, b);
      barycentrics.push(1, 1, 1);
    }
  }

  const vertexRanges: [number, number][] = [];
  let vertex = corners.length;
  maskData.polygons.forEach((polygon, i) => {
    const [r, g, b] = colorToRGB01(colorCtx, polygon.fill);
    const outputCount = polygonOutputCounts[i] ?? 1;
    for (let t = 0; t < outputCount; t++) {
      colors.push(r, g, b, r, g, b, r, g, b);
      barycentrics.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
    }
    vertexRanges.push([vertex, outputCount * 3]);
    vertex += outputCount * 3;
  });

  return { positions, colors, barycentrics, uvs, centroids, vertexCount: positions.length / 2, vertexRanges };
}

/**
 * Uploads a buildStaticMaskMesh result into an already-initialized GLState's own buffers --
 * shared by ProjectMaskItem's initial mount (setupCanvas) and its own syncPeaks handle method,
 * which re-runs this same build/upload after every committed peak edit. Leaves the highlight
 * buffer untouched -- neither caller owns its contents, see their own comments for who does
 * (recolorHighlight, project-mask-item.tsx).
 */
export function uploadStaticMaskMesh(
  state: GLState,
  mesh: { positions: number[]; colors: number[]; barycentrics: number[]; uvs: number[]; centroids: number[] },
): void {
  const { gl } = state;
  gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.colors), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.barycentricBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.barycentrics), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.uvs), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.centroidBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.centroids), gl.STATIC_DRAW);
}

export type MaskMeshRefs = {
  positionsRef: React.RefObject<number[]>;
  colorsRef: React.RefObject<number[]>;
  barycentricsRef: React.RefObject<number[]>;
  uvsRef: React.RefObject<number[]>;
  centroidsRef: React.RefObject<number[]>;
  vertexCountRef: React.RefObject<number>;
  dirtyRef: React.RefObject<boolean>;
  curvesRef: React.RefObject<MaskCurve_V1_0[]>;
  glowColorRef: React.RefObject<[number, number, number]>;
};
