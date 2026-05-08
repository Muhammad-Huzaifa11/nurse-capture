import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    /** Use the brand purple as the maskable icon background so the OS-cropped
     * tile stays on-brand on both iOS and Android home screens. */
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: {
        ...minimal2023Preset.maskable.resizeOptions,
        background: '#5b52d6',
      },
    },
    /** Apple touch icon must have an opaque background (iOS does not respect
     * transparency on home-screen tiles). */
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: {
        ...minimal2023Preset.apple.resizeOptions,
        background: '#5b52d6',
      },
    },
  },
  images: ['public/pwa-source.svg'],
})
