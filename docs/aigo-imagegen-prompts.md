# AiGo ImageGen Prompt Recipes

Use these prompt recipes when regenerating project-bound raster UI assets. The default output target is WebP; keep PNG only when platform compatibility requires it.

## Child Profile Avatars

Use the built-in `$imagegen` workflow once per avatar, then remove the chroma-key background and export a 256px WebP with alpha.

Base prompt:

```text
Use case: stylized-concept
Asset type: AiGo child profile avatar icon, final asset will be converted to WebP with transparent corners
Primary request: create one standalone circular avatar badge for <gender + age band>
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background outside the badge only, for background removal
Subject: one cheerful Korean <infant/baby/toddler/preschool child>, <age detail>, centered head-and-shoulders portrait inside a complete circular badge
Style/medium: warm polished 3D clay illustration, cute family app icon, soft rounded shapes, consistent toy-like proportions
Composition/framing: square 1:1 icon, full circular badge visible with generous padding, face centered, shoulders contained inside the circle, no cropping at the head, hair, ears, arms, or badge edge
Lighting/mood: soft studio lighting, friendly and calm
Color palette: <boys: aqua/mint/teal badge and clothing; girls: peach/coral/rose badge and clothing>, warm skin tones, dark brown hair, subtle cheek accents
Materials/textures: matte clay-like surfaces, crisp badge edge, clean silhouette readable at 28-64 px
Constraints: exactly one child, complete circular badge, no text, no letters, no numbers, no logo, no watermark; background must be one uniform #00ff00 with no shadows, gradients, texture, floor, or lighting variation; do not use #00ff00 anywhere in the badge or subject
Avoid: image grid, sticker sheet, cropped body, transparent-looking checkerboard, photorealism, harsh outlines, oversized hands, props, hats, pacifier
```

Generated set:

- `boy-under6-avatar.webp`: Korean infant boy, under 6 months, pale aqua badge, sky-blue and cream romper.
- `boy-6-12-avatar.webp`: Korean baby boy, 6-12 months, pastel blue-green badge, teal and cream outfit.
- `boy-12-24-avatar.webp`: Korean toddler boy, 12-24 months, soft seafoam badge, teal and cream top.
- `boy-24-48-avatar.webp`: Korean toddler boy, 24-48 months, pastel mint badge, teal and cream clothing.
- `boy-48-84-avatar.webp`: Korean preschool boy, 48-84 months, muted mint badge, teal jacket over cream shirt.
- `girl-under6-avatar.webp`: Korean infant girl, under 6 months, soft peach badge, coral-pink and cream romper.
- `girl-6-12-avatar.webp`: Korean baby girl, 6-12 months, pastel peach-pink badge, rose and cream outfit.
- `girl-12-24-avatar.webp`: Korean toddler girl, 12-24 months, warm blush badge, coral-pink and cream top.
- `girl-24-48-avatar.webp`: Korean toddler girl, 24-48 months, pastel coral badge, coral and cream clothing.
- `girl-48-84-avatar.webp`: Korean preschool girl, 48-84 months, muted coral-pink badge, coral cardigan over cream shirt.
