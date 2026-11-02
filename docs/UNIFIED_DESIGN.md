# Aporia Realms unified design

Interactive reference: https://www.magicpath.ai/files/467983890078912512

## Identity

Aporia Realms, by Aporia Nous. Cinematic dark fantasy, muted gold, warm ivory, charcoal. Solis Grave remains the first official world. Use descriptive Game Master prose, sensory detail and open player agency.

## Shared implementation

Load realms-design.css after existing application/theme styles. Both repositories carry the same stylesheet. It uses existing DOM classes, preserves current APIs and state handling, and provides shared typography, colors, borders, controls, focus indicators, narrative spacing and reduced-motion handling.

Tokens: background #0a0c10; panel #11151b; text #eee5d4; muted #b4b0a7; gold #d6b77a; bright gold #ebce95. Serif headings and narration; system sans-serif controls. Story measure 760px. Controls have a minimum 44px height; mobile composer text is 16px.

## Screen coverage

The interactive design reference covers the public landing page, campaigns, four-step adventure setup, play, journal, character, discovered-world atlas and settings. Preview data is illustrative. Its actions do not invoke the World Engine, and its temporary notes are not persistent campaign records.

## Integration boundaries

The CSS is integrated with the existing site/player markup on this branch. The MagicPath layouts remain a design reference rather than a replacement runtime. Character creation, authentication, world building, combat states, administration and all deeper error/loading states still need page-by-page runtime visual verification before declaring the entire product redesign complete.

## Validation

MagicPath React build completed successfully; rendered landing preview inspected. Existing source inspected via GitHub. Shared stylesheet link added to entry points. No gameplay or engine rules changed. Live backend behavior and full responsive production flows have not been tested in this work.
