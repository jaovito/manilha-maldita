# Asset inventory - M6 #9

Local inventory from 2026-10-28; owner decision recorded on 2026-10-30; two additional QA captures recorded on 2026-10-31. Tracked in [issue #9](https://github.com/jaovito/manilha-maldita/issues/9). This document identifies files and provenance; it does not establish ownership or clear third-party rights.

## Owner decision and remaining review

The owner chose to preserve original artwork/audio without an open reuse license. [NOTICE](../NOTICE.md) is the canonical scope notice: bundled PNG/SVG artwork and MP3 recordings are excluded from the root MIT grant; separate rights-holder permission is required for reuse, adaptation or redistribution, subject to rights actually held and existing legal/platform permissions. Code and documentation remain MIT. Fonts retain their existing licenses. This policy does not assert exclusive copyright over AI-generated material or revoke existing permissions.

Every file in `apps/web/public` is copied by Vite into the build, including comparison fonts and older artwork not currently imported by the UI. The two captures in `docs/screenshots/avatar-catalog/` and two result captures in `docs/screenshots/m6-result/` use local fixtures; embedded artwork retains its asset status. Source-code SVG/HTML, Web Audio effects and generation/rendering scripts remain source code under MIT. Software dependencies retain their own notices.

- Fonts include OFL 1.1 notices, except Roboto Slab (Apache 2.0). The Manilha Card Numerals derivative retains the Pixelify Sans notice and uses another name. These licenses are not replaced or restricted by the asset reservation.
- Artwork READMEs record ImageGen generation, crops and owner-supplied references. Authorization to redistribute those references was not located in the repository. Declared provenance alone does not prove ownership or clear every derivative.
- The three bundled SVG frames are documented as code-drawn artwork. They fall within the bundled-artwork reservation, while inline application SVG and rendering/generation source code remain MIT.
- The two MP3 recordings are original arrangements rendered with the macOS General MIDI bank. The bank is not versioned. Evidence of the terms applicable to redistribution of these recordings was not located; approving the composition does not establish third-party bank clearance.
- The owner decision is recorded, but #9 remains open for reference-image and rendering-bank evidence, review and publication. No open asset license was added and no third-party rights were changed.

## Provenance and notices

| Group | Source or reproduction | Status |
|---|---|---|
| Base artwork, portraits and frames | [Artwork README](../apps/web/public/art/README.md) | Rights reserved where held; references pending |
| Layers and power cards | [Layers README](../apps/web/public/art/layers/README.md) | Rights reserved where held; references pending |
| Table scenery | [Scenery README](../apps/web/public/art/table-layers/README.md) | Rights reserved where held; references pending |
| Table materials | [Materials README](../apps/web/public/art/table-ui/README.md) | Rights reserved where held; references pending |
| Cosmetics | [Cosmetics README](../apps/web/public/art/cosmetics/README.md) | Rights reserved where held; derived from base artwork |
| Avatars 5-8 | [Avatars README](../apps/web/public/art/avatars/README.md) | Rights reserved where held; previous atlas used as reference |
| Rendered music | [Audio README](../apps/web/public/audio/README.md), [Swift arrangement](audio/render-results.swift) | Recording rights reserved where held; bank review pending; bank not bundled |
| Pixelify Sans and numeral derivative | [OFL](../apps/web/public/fonts/OFL-PixelifySans.txt), [generator](../tooling/fonts/README.md) | OFL 1.1 unchanged |
| Jersey 10 / Jersey 25 | [Jersey 10 OFL](../apps/web/public/fonts/OFL-Jersey10.txt), [Jersey 25 OFL](../apps/web/public/fonts/OFL-Jersey25.txt) | OFL 1.1 unchanged |
| Seven comparison fonts | [Sources, hashes and notices](../apps/web/public/fonts/comparison/README.md) | Six OFL 1.1; Roboto Slab Apache 2.0 |

## Files and integrity

Paths are relative to the repository root. SHA-256 identifies the audited bytes; it does not establish rights to use them. The inventory includes older artwork and prototype fonts still shipped in the public directory.

| File | SHA-256 |
|---|---|
| `apps/web/public/art/avatars/avatar-5.png` | `154a1e3093397e448e8385cef1d110a9943aa8cf90e7ec5661cb3a82818ec4cc` |
| `apps/web/public/art/avatars/avatar-6.png` | `db0305080e820595dd6aa5ac00dc962997bbd1921b27329d57bdc864db861485` |
| `apps/web/public/art/avatars/avatar-7.png` | `8d7c82125af33c0c8a258104804538fce6a620aa0c7c78ff4143596d1804a9ca` |
| `apps/web/public/art/avatars/avatar-8.png` | `47696fa82c78e2139580b0c1c93fa3fda4c9128558ab23b8bed40b8ae7d617de` |
| `apps/web/public/art/avatars-pixel.png` | `2db013ab86425465276cceecf1777f770d620e94d70de1e06e4339c4105e65ca` |
| `apps/web/public/art/avatars.png` | `68ff4188fc8072e8b2bf4275ab74b8f215c2581e2a714a08c7f513136d308b72` |
| `apps/web/public/art/card-back.png` | `98749bae434b0216b4a4b5541170509da144be31bcb2779fe978c6dc9cd36102` |
| `apps/web/public/art/cosmetics/deck-arcane.png` | `2b3e30ed01eb11ee1d1e01f25b0a76c12fd1bd8231817c6fe50220aef79ba15d` |
| `apps/web/public/art/cosmetics/deck-ember.png` | `756af845fe5fbcd2fcef5ea3a441b60250ef632c1367e06dc1bf69eff272fe75` |
| `apps/web/public/art/cosmetics/felt-burgundy.png` | `c9b06d06b83cb398d84041a64d2b2f2ec31b9303443edcfe91856d8b601dd5dd` |
| `apps/web/public/art/cosmetics/felt-midnight.png` | `02caad09f8fc6129906b573afe5e9749ebe3e8325c26b163ffc6b38a2700aed7` |
| `apps/web/public/art/layers/ace-spades.png` | `d65da99902c0bf74976db8bfba238d9c33ff24ad79d8f31481a9dc0db733bdec` |
| `apps/web/public/art/layers/border-ne.png` | `0357233ae2f57d0cbe515b9422e694da63b2fb958d3383ce42cac9630a6cf0a0` |
| `apps/web/public/art/layers/border-nw.png` | `4876f4f0ea9dce0b45b4545c5d4b84392558a7c8f3635128a87460f802650c0c` |
| `apps/web/public/art/layers/border-se.png` | `77c4d50ef0fc0b6e255d4bdab7dc0795172e872d66fc3a8fc10d11641f56be42` |
| `apps/web/public/art/layers/border-sw.png` | `bd3a0213dd0ceb22a5e2b0d77579c33a1d3daf976cd3f3d13323f065cff2e2df` |
| `apps/web/public/art/layers/candle.png` | `d5089e6a26d2f83065cc592dc5a147a546e00a56ecbb98ce82af234b20d0f0e5` |
| `apps/web/public/art/layers/coins.png` | `f95e9e737d914a32312f132579ed6a7da5d1057449861bc1547ab401b40b6520` |
| `apps/web/public/art/layers/corner-ne.png` | `4a2cccc1d2e4b25cda82788a89d976cdc3109e15ab824d3df4021b0ea22ed54a` |
| `apps/web/public/art/layers/corner-nw.png` | `c223d243168e65212aeea97d0450b91a3dc08bda0c007a0c7defa5f472d85a2a` |
| `apps/web/public/art/layers/corner-se.png` | `ce72672ab806f98d70faf0d2d0bcb65929580d8c160e028d55df6b44cc6ed49b` |
| `apps/web/public/art/layers/corner-sw.png` | `5e8a46ad882c22c5c5003afdf84d31de6dc97080ca3c2d3643cba89f37ed13f3` |
| `apps/web/public/art/layers/crest-bottom.png` | `ea057b62a36bb696149b4af54762d9fb1223caf7e024752f58e356a8b033faa9` |
| `apps/web/public/art/layers/crest-left.png` | `a736c413643deb8f4ba38495c3e74372b910c17914ab511cb60f318139c21ba9` |
| `apps/web/public/art/layers/crest-right.png` | `f001f63cd3a37eb5c7ae92bb4a5265773e635ad65e230d8dd16768c7f6378673` |
| `apps/web/public/art/layers/crest-top.png` | `27c4f5387f67bb630be2d9abb7dee1bf90a294eb79e7f33ff95a8e13ee28b16e` |
| `apps/web/public/art/layers/deck.png` | `ba7dcc5302be414e2bd62d4ffb43d438396e83fbc364b85fde7c2a17f9edb7f5` |
| `apps/web/public/art/layers/felt.png` | `570e0dd41b13e1075f11b514345d45530a9cf0cf11bebfbd3310e5e8c926d2f9` |
| `apps/web/public/art/layers/logo.png` | `3c42cf8e3034d9ba215f5e5d80ede79b89ebb7a67e07d86d320ef608613bee65` |
| `apps/web/public/art/layers/mate.png` | `f9343c003bf7436f9b734bcb7477a7143b12c481c491135bc9a7b1c95e09dcf4` |
| `apps/web/public/art/layers/power-card-boost.png` | `20efbb712cd2a7396a11494f6d701ca1008424f92f606a734c71136539694696` |
| `apps/web/public/art/layers/power-card-exchange.png` | `67845d97728e53fcc33cc1fd07adae116e264ba24818f1c8be3cba6aa58665fa` |
| `apps/web/public/art/layers/power-card-mask.png` | `849fd42924b3ca64a92c3b4fd036355fad3760b7675bc57d438a9dcc9c307541` |
| `apps/web/public/art/layers/power-card-spy-character.png` | `cfa500b3dc042b67298a6ab00f9e447f4f5af04797185417abbcfdbd7aa15360` |
| `apps/web/public/art/layers/power-card-spy.png` | `1740edebb39298d6d8ed126e004b79b58a0553b5aded0743239c6cbb02b03ee8` |
| `apps/web/public/art/layers/powers.png` | `63395c6a4adb4098db266435c26f0adc4899a060eea66ecd152dc98b6461ef42` |
| `apps/web/public/art/layers/seven-hearts.png` | `93e33f2bd66f4f2d65a881baea009ece6f0ca08dd4f0bdcd783ec9d8dca4e385` |
| `apps/web/public/art/lobby-frame.svg` | `dbd4a4082e6e5a3212f0332aac0342c2e48a6e5a28c8d85ff934abd5cce892ee` |
| `apps/web/public/art/menu-button-frame.svg` | `0087309e2de8a885722fcf0e81d9c5e2389e5734d84c3f463c2b117111a8a186` |
| `apps/web/public/art/menu-icons.png` | `81ce7291a6363a476431ff25350a358544327b4ce811d78bd488178fd8d2760d` |
| `apps/web/public/art/menu-reference-plate.png` | `d5e647507e16deace86bd50a5bddbb306564a75004280b1a35199044aaafce9f` |
| `apps/web/public/art/menu-tabletop.png` | `35f8985592e30e04ef3ce5039606ec8fa6a2432d1fe3d556b67e488d5d8d3cac` |
| `apps/web/public/art/power-illustrations.png` | `41284a0e82787a8caa637a010d8ed235128dff33f624bc01d02db5c13bad5245` |
| `apps/web/public/art/profile-frame.svg` | `4b4e361cded27de5cde69f1130fd05c58d7ebfbd7c979a7724dcef3f4de3e5d3` |
| `apps/web/public/art/table-layers/cloth.png` | `d7c1b93b10d9a75d407609585531f17998c3d0559881c72d9a8b3761ee7a8788` |
| `apps/web/public/art/table-layers/ornament.png` | `e280e6ed7e455b54c9ac3417f6376648226fddee5e04a073998b55191cafc5a1` |
| `apps/web/public/art/table-layers/rail.png` | `330fa5a71d47e219571f0d78597173fb61df37ffb3054b931d4047e4d222c516` |
| `apps/web/public/art/table-layers/wood.png` | `9ca72a420be5b14fde835251c3e7f75a262f0234b03baae9b0df03362601efed` |
| `apps/web/public/art/table-ui/crest-enemy.png` | `3f4ffc04f1feea9bc3f80b5d2ed0cf720283c439d5be3e3af7ff575f198bddee` |
| `apps/web/public/art/table-ui/crest.png` | `bd6c5b2e7c484d8dd0809d19d2ae825797b7ec24d09be92511ac962c723f6567` |
| `apps/web/public/art/table-ui/parchment.png` | `5fbb295cda6390d2a1b6aa760adbdb1bddf6ba13adb5f1e9fe0b151f39dd112e` |
| `apps/web/public/art/table-ui/ribbon-green.png` | `36a1c92fc7e1b789a80bf03517384ee91dce8d33a86bd714cb7222a7d43e82c3` |
| `apps/web/public/art/table-ui/ribbon.png` | `8768b493cf4410f30fe51ffa2ba86b3c7a86a2b65237d68fac67423bc8fd8af9` |
| `apps/web/public/art/table-ui/wood.png` | `a53b8c2d97b2f092ffccb1cdfb01517fbbf1d2aefda619e69b80936ec979adb5` |
| `apps/web/public/art/tabletop.png` | `afd52ebbc6d341ca2efb4c17a582b5c69536d146f4c176d73fac5d196cd6955e` |
| `apps/web/public/audio/match-defeat.mp3` | `36972be1a6cf04cee7c68843b97fe94fd0c8f215c38b627496c04c8e1ba65097` |
| `apps/web/public/audio/match-victory.mp3` | `2dc8d11f49e04c06695bc75fb33e3fc9859173d7315b24b177e58cee10adfa75` |
| `apps/web/public/fonts/Jersey10.ttf` | `db9cbd091617048a145d249daa2b815fe7083be6ab66ac26626e21a4e01c3e82` |
| `apps/web/public/fonts/Jersey25.ttf` | `4d4acdd89a748e9548041a3046d95536c500e1a7be9197c6aeef7d980f79d370` |
| `apps/web/public/fonts/ManilhaCardNumerals.ttf` | `9a422b9fa8e06301052ec6e7f34dbbca8a843f7f23acc9814949ab78fa82b453` |
| `apps/web/public/fonts/PixelifySans.ttf` | `9ba86cd010a4de309d263ceff8e8044092c9db7efda869620cb9ff1c4389e8a5` |
| `apps/web/public/fonts/comparison/atkinsonhyperlegible.ttf` | `5a3b0c8cc8ca545155150b4512a1fa248298df121c50d6557e651e61fbdab92f` |
| `apps/web/public/fonts/comparison/ibmplexsanscondensed.ttf` | `b65492d86cdd5cd9d43d2671b55d5d36fec36859fc8b08bc6aba78e441d6c849` |
| `apps/web/public/fonts/comparison/micro5.ttf` | `08a08c0d10129d2ecd869ff2f8914fcbf32487d3cbee3568b2a2957866dfdac8` |
| `apps/web/public/fonts/comparison/robotoslab.ttf` | `786ae192477447d33c6672c3055fba7cbfe45184c9a79e77a14f15716ca05b16` |
| `apps/web/public/fonts/comparison/sourceserif4.ttf` | `97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b` |
| `apps/web/public/fonts/comparison/tiny5.ttf` | `588626f2c1b164f55927c0d8123f4bc134651aad7d257da68fc19b0824b0d8fa` |
| `apps/web/public/fonts/comparison/vt323.ttf` | `cf4de751ada78ceac033dbe16a687742939995b77bc2a052ae17a4957958594d` |
| `docs/screenshots/avatar-catalog/desktop.png` | `9e262b23825a9bf5a931758708e7cba308960615b8ac009a6cf1d61b951c82e4` |
| `docs/screenshots/avatar-catalog/mobile.png` | `2e515e4e60aea2d87afe0ea2745aa0f97a70ced5bcd0283919c156c84c672a14` |
| `docs/screenshots/m6-result/desktop.png` | `8e744285a1b4ae9ac7355d85790158dc1bd9fddb9c342b8594fb402ff4b625e5` |
| `docs/screenshots/m6-result/mobile.png` | `fce575fc52ee92e84c2ec3d61c8f3e0bd9ee9570799941ca8c4a09577034b137` |
