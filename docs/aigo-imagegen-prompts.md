# AiGo ImageGen Prompt Recipes

Use these prompt recipes when regenerating project-bound raster UI assets. The default output target is WebP; keep PNG only when platform compatibility requires it.

## Child Profile Avatars

Use the built-in `$imagegen` workflow once per avatar, then remove the chroma-key background and export a 256px WebP with alpha. Each avatar should include one tiny age cue item so the profile reads at a glance.

Base prompt:

```text
Use case: stylized-concept
Asset type: AiGo child profile avatar icon, final asset will be converted to WebP with transparent corners
Primary request: create one standalone no-border circular avatar for <gender + age band>, with <age cue item>
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background outside the badge only, for background removal
Subject: one cheerful Korean <infant/baby/toddler/preschool child>, <age detail>, centered head-and-shoulders portrait inside a clean circular color backdrop, holding or wearing <age cue item> so it is clearly visible but not blocking the face
Style/medium: warm polished 3D clay illustration, cute family app icon, soft rounded shapes, consistent toy-like proportions
Composition/framing: square 1:1 icon, full circular color backdrop visible with generous padding, face centered, no rim, no outline, no border, no ring, child and item contained inside the circle with no cropping
Lighting/mood: soft studio lighting, friendly and calm
Color palette: <boys: aqua/mint/teal backdrop and clothing; girls: peach/coral/rose backdrop and clothing>, warm skin tones, dark brown hair, subtle cheek accents
Materials/textures: matte clay-like surfaces, crisp badge edge, clean silhouette readable at 28-64 px
Constraints: exactly one child and the requested age cue item; plain clothing with no printed graphics, patches, icons, badges, or patterns; no text, no letters, no numbers, no logo, no watermark; background must be one uniform #00ff00 with no shadows, gradients, texture, floor, or lighting variation; do not use #00ff00 anywhere in the circle, subject, or item
Avoid: white rim, cream rim, outline, badge border, sticker border, image grid, cropped body, transparent-looking checkerboard, photorealism, harsh outlines, oversized hands, extra props
```

Generated set:

- `boy-under6-avatar.webp`: Korean infant boy, under 6 months, pale aqua backdrop, baby bottle.
- `boy-6-12-avatar.webp`: Korean baby boy, 6-12 months, pastel blue-green backdrop, pacifier.
- `boy-12-24-avatar.webp`: Korean toddler boy, 12-24 months, soft seafoam backdrop, toy car.
- `boy-24-48-avatar.webp`: Korean toddler boy, 24-48 months, pastel mint backdrop, dinosaur toy.
- `boy-48-84-avatar.webp`: Korean preschool boy, 48-84 months, muted mint backdrop, scooter helmet.
- `girl-under6-avatar.webp`: Korean infant girl, under 6 months, soft peach backdrop, baby bottle.
- `girl-6-12-avatar.webp`: Korean baby girl, 6-12 months, pastel peach-pink backdrop, pacifier.
- `girl-12-24-avatar.webp`: Korean toddler girl, 12-24 months, warm blush backdrop, bunny plush doll.
- `girl-24-48-avatar.webp`: Korean toddler girl, 24-48 months, pastel coral backdrop, small pink fashion doll.
- `girl-48-84-avatar.webp`: Korean preschool girl, 48-84 months, muted coral-pink backdrop, princess crown and star wand.

## Region Browsing Images

Use the built-in `$imagegen` workflow once per region, then convert the final project-bound asset to WebP under `public/images/regions/`. Region names are rendered by the app as HTML text, so generated images must not contain text.

Base prompt:

```text
Use case: stylized-concept
Asset type: AiGo region browsing map thumbnail, final asset will be converted to WebP
Primary request: present a clear, 45-degree top-down isometric miniature 3D cartoon scene of <region subject>, featuring its most iconic landmarks and architectural elements
Scene/backdrop: clean, minimalistic composition with a soft solid-colored background and good weather integrated into the city or regional environment
Style/medium: polished miniature 3D cartoon scene with soft refined textures, realistic PBR materials, and family-friendly warmth
Composition/framing: square 1:1 image, centered miniature scene with generous padding, readable at small map-pin sizes
Lighting/mood: gentle lifelike lighting and shadows, sunny pleasant weather, calm and inviting
Materials/textures: soft matte architecture, small trees, water or mountain elements where relevant, crisp silhouettes
Constraints: no text, no letters, no numbers, no logo, no watermark; avoid clutter; keep the region visually distinct from the others
Avoid: title text, signboards with legible writing, dark atmosphere, heavy blur, generic skyline with no local landmarks
```

Generated set:

- `seoul.webp`: Seoul, Korea, with N Seoul Tower, Gyeongbokgung palace roofs, Han River bridges, and modern high-rises.
- `incheon.webp`: Incheon, Korea, with Songdo skyline, Incheon Bridge, coastal port elements, and airport travel cues.
- `gyeonggi.webp`: Gyeonggi-do, Korea, with Suwon Hwaseong fortress, family parks, modern satellite cities, and green hills.
- `gangwon.webp`: Gangwon, Korea, with Seoraksan mountain ridges, ski resort roofs, pine forests, and East Sea coastline.
- `chungbuk.webp`: Chungcheongbuk-do, Korea, with lake scenery, forested inland hills, Cheongju urban landmarks, and family-friendly public buildings.
- `sejong.webp`: Sejong, Korea, with government complex architecture, Geum River paths, planned city blocks, and clean public plazas.
- `daejeon.webp`: Daejeon, Korea, with Expo science park landmarks, research district buildings, green parks, and city boulevards.
- `chungnam.webp`: Chungcheongnam-do, Korea, with Baekje cultural roofs, coastal mudflat scenery, gentle hills, and family travel roads.
- `jeonbuk.webp`: Jeonbuk, Korea, with Jeonju hanok village roofs, open farmland, gentle mountains, and cultural museum buildings.
- `gwangju.webp`: Gwangju, Korea, with Mudeungsan mountain backdrop, cultural art center buildings, city streets, and warm public plazas.
- `jeonnam.webp`: Jeollanam-do, Korea, with island coastline, Suncheon bay reeds, coastal bridges, gardens, and small harbor towns.
- `daegu.webp`: Daegu, Korea, with Palgongsan mountain hints, modern city avenues, cultural landmarks, and warm sunny urban parks.
- `gyeongbuk.webp`: Gyeongsangbuk-do, Korea, with Gyeongju heritage roofs, Andong traditional village, rolling mountains, and river scenery.
- `busan.webp`: Busan, Korea, with Gwangan Bridge, Haeundae beach, colorful hillside village buildings, and coastal high-rises.
- `ulsan.webp`: Ulsan, Korea, with Taehwagang river garden, whale and coastal motifs, modern city architecture, and green park paths.
- `gyeongnam.webp`: Gyeongsangnam-do, Korea, with coastal islands, Jinhae cherry blossom streets, family parks, and harbor bridges.
- `jeju.webp`: Jeju Island, Korea, with Hallasan mountain, volcanic stone walls, ocean cliffs, tangerine trees, and family resort buildings.

## Region Map Marker Icons

Use the built-in `$imagegen` workflow once per region, then remove the chroma-key background and export a 512px WebP with alpha under `public/images/region-icons/`. These are used as small map markers, so prefer one friendly mascot-like landmark or object over a full scene.

Base prompt:

```text
Use case: background-extraction
Asset type: transparent map marker icon for a kids/family travel app
Primary request: create a cute <region> regional icon featuring <one representative mascot/object>
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal
Subject: one adorable rounded <representative mascot/object>, warm smiling face, one small local accent, child-friendly proportions
Style/medium: polished miniature 3D cartoon icon, soft toy-like proportions, consistent cute 3D regional mascot set, app icon quality, crisp silhouette
Composition/framing: centered single subject, front-facing 3/4 view, large simple silhouette, no base plate, no circular badge, no scenery
Lighting/mood: soft cheerful daylight on the subject only, no cast shadow and no contact shadow
Color palette: locally appropriate colors, avoid using #00ff00 anywhere in the subject
Materials/textures: refined PBR clay/plastic/stone/wood texture as appropriate, smooth rounded edges
Text: no text
Constraints: background must be one uniform #00ff00 with no gradients, shadows, texture, floor, reflection, watermark, letters, or logo; keep crisp separated edges
Avoid: photorealism, busy scenes, tiny details, dark mood, scenery, badge frame, white/cream background, text
```

Generated set:

- `seoul.webp`: friendly Namsan Seoul Tower mascot.
- `incheon.webp`: friendly airport control tower with small airplane accent.
- `gyeonggi.webp`: friendly Suwon Hwaseong fortress gate mascot.
- `gangwon.webp`: friendly snowy mountain and pine tree mascot.
- `chungbuk.webp`: friendly inland lake-and-mountain droplet mascot.
- `sejong.webp`: friendly book and golden crown mascot.
- `daejeon.webp`: friendly science rocket mascot.
- `chungnam.webp`: friendly Baekje stone pagoda mascot.
- `jeonbuk.webp`: friendly hanok house mascot.
- `gwangju.webp`: friendly art palette mascot.
- `jeonnam.webp`: friendly island lighthouse mascot.
- `daegu.webp`: friendly apple mascot with sun accent.
- `gyeongbuk.webp`: friendly Cheomseongdae-inspired stone observatory mascot.
- `busan.webp`: friendly ocean wave with bridge arch accent.
- `ulsan.webp`: friendly lighthouse and sunrise mascot.
- `gyeongnam.webp`: friendly turtle ship-inspired boat mascot.
- `jeju.webp`: friendly Dol Hareubang mascot with tangerine accent.
