# Flipper - Premium Coin Flip Simulator

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

Flipper is a visually stunning, premium 3D coin flip simulator designed for the modern web. Built with vanilla HTML, CSS, and JavaScript, it offers a seamless and responsive experience with rigorous focus on aesthetics and accessibility.

## 🌟 Features

*   **3D Physics Animation:** Realistic coin rotation and settling physics using CSS 3D transforms.
*   **Premium Aesthetics:** Glassmorphism, metallic gradients, and smooth shadows.
*   **Theme Support:** Toggle between Sleek Dark Mode (default) and Clean Light Mode.
*   **Built-in Sound:** Procedural audio generation using the Web Audio API (no external assets required).
*   **Statistics Tracking:** Persists your flip history (Heads/Tails count) locally.
*   **Accessibility:** WAI-ARIA compliant, screen reader support, and keyboard navigation.
*   **Secret Controls:** Hidden mechanics to influence the outcome (see below).

## 🎮 Controls

*   **Click/Tap:** Tap the "FLIP COIN" button to flip.
*   **Reset:** Click "Reset Stats" to clear your history (with confirmation).
*   **Theme:** Click the sun/moon icon in the top right.

### 🤫 Secret "Magic" Controls
Want to impress your friends? Use these hidden triggers to determine the result:

**Mouse/Touch:**
*   **Force Heads:** Click the **Left 25%** of the "FLIP COIN" button.
*   **Force Tails:** Click the **Right 25%** of the "FLIP COIN" button.
*   **Random:** Click the **Center 50%** of the button.

**Keyboard:**
*   **Force Heads:** Press `ArrowLeft`
*   **Force Tails:** Press `ArrowRight`
*   **Random:** Press `Space` or `Enter`

## 🛠️ Installation

Simply clone the repository and open `index.html` in your browser. No build process or dependencies required!

```bash
git clone https://github.com/Prakhar0206/Flipper.git
cd Flipper
# Open index.html
```

## 🏗️ Technical Details

*   **Zero Dependencies:** Pure Vanilla JS.
*   **Performance:** Optimized for 60fps animations.
*   **Storage:** Uses `localStorage` to save your stats and theme preference.
*   **Audio:** Synthesized in real-time, reducing network requests.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👤 Author

**Prakhar Aggarwal**
- GitHub: [@Prakhar0206](https://github.com/Prakhar0206)
