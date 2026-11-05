# VELTRIX — design direction "Signal"

Internal note for the third rebuild. Not part of the published page.

## Reference study (Framer, Stripe, Linear, Webflow, Notion)

| | Strongest visual technique | Strongest motion / interaction | Imagery and video | Product presentation | What VELTRIX takes from it |
|---|---|---|---|---|---|
| **Framer** | Near-black canvas where the product UI itself is the hero image | Agent panel "thinking" beside a live canvas; tiles that tilt into 3D | Short muted loops inside UI frames, never decorative | The real editor, cropped and annotated | Let the product be the hero; video lives inside product frames |
| **Stripe** | Light page with one controlled burst of colour; confident, long headlines | Ambient canvas gradients; numbers ticking live | Commissioned photography with a strong single colour grade | Complex products shown as small, legible UI fragments | One accent with discipline; long specific headline; motion as "live data" |
| **Linear** | Dark, low-contrast UI with crisp hierarchy; monospace figure labels | Product frames that rise and flatten as you scroll | Almost none: the interface carries the page | Realistic, dense UI with believable states | Dark product surfaces with real states; mono micro-labels; restraint |
| **Webflow** | Big type over full-bleed product canvases | Scroll-linked staging that explains features step by step; card stacks in perspective | Video case stories, launch films with a play control | Feature tabs that swap a large preview | Pinned, scroll-driven explanation; a film with real controls |
| **Notion** | Warm paper background, friendly illustration, generous space | Prompt → answer demos that show what AI actually does | One hero video, otherwise UI | "Bring X / Get answers / Automate" cards with concrete examples | Copilot shown through concrete, honest examples |

## The VELTRIX direction: "Signal"

**Idea.** A business is a set of handoffs. In VELTRIX each handoff is a *signal*: a small lime pulse that leaves one part of the business and arrives, filed and owned, somewhere else. The whole site uses that one motif. Lines draw, pulses travel, and things arrive and settle. Motion always means work moving.

**Colour.** Graphite world with warm paper pauses.
- Ink `#0C1217`, graphite `#101820`, charcoal `#202B34`, panel `#16202A`
- Paper `#F5F3ED`, mist `#E9EDF0`, slate `#8C9AA5`
- One accent: **signal lime `#C9F36B`** (text on lime is graphite). Aqua `#71DAD1` appears only as a second chart series.
- Status: success `#7BD88F`, warning `#F2B84B`, danger `#F0745A`.

**Type.**
- Display: **Sora**, 600, tight tracking (−0.045em), short deliberate line breaks.
- Text and interface: **Geist**, with **Geist Mono** for labels, figures and timestamps.

**Media.**
- Original product films rendered from the real VELTRIX interface components. They are labelled as interface animations, never as screen recordings.
- A 40-second overview film with full player controls.
- Four short feature loops.
- Licensed editorial photography, used sparingly.

**Motion system.**
- Durations: 0.2s for micro, 0.6s for components, 1–1.4s for scenes.
- Easing: `expo.out` for entrances, `power3.inOut` for transforms; springs only on small confirmations.
- Every entrance is a different gesture: mask, draw, assemble, flatten or count.
- Reduced motion shows the final states with no movement.
