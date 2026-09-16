/**
 * Polyfill leve de APIs de canvas para o pdfjs-dist em Node 20
 * (runtime serverless da Vercel). O pdfjs tenta carregar
 * @napi-rs/canvas via process.getBuiltinModule — disponível apenas
 * no Node 22+ — e, sem sucesso, deixa DOMMatrix/Path2D/ImageData
 * indefinidos, derrubando o carregamento do módulo
 * ("DOMMatrix is not defined").
 *
 * A extração de TEXTO de PDF não renderiza nada: as classes só
 * precisam existir com a interface mínima que o pdfjs referencia.
 */
function ensureCanvasPolyfills() {
    const g = globalThis;
    if (!g.DOMMatrix) {
        class DOMMatrixPolyfill {
            m;
            constructor(init) {
                // Identidade 2D (a, b, c, d, e, f) + linha implícita [0,0,0,1]
                this.m = [1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];
                if (Array.isArray(init) || init instanceof Float32Array) {
                    const a = Array.from(init);
                    if (a.length === 6) {
                        this.m = [a[0], a[1], 0, 0, a[2], a[3], 0, 0, a[4], a[5], 0, 0, 0, 0, 0, 1];
                    }
                    else if (a.length === 16) {
                        this.m = a;
                    }
                }
            }
            multiplySelf() { return this; }
            preMultiplySelf() { return this; }
            translate() { return this; }
            scale() { return this; }
            rotate() { return this; }
            invertSelf() { return this; }
            getTransform() {
                return { a: this.m[0], b: this.m[1], c: this.m[4], d: this.m[5], e: this.m[12], f: this.m[13] };
            }
        }
        g.DOMMatrix = DOMMatrixPolyfill;
    }
    if (!g.Path2D) {
        class Path2DPolyfill {
            cmds = [];
            addPath() { }
            constructor(cmds) {
                if (cmds)
                    this.cmds = [cmds];
            }
        }
        g.Path2D = Path2DPolyfill;
    }
    if (!g.ImageData) {
        class ImageDataPolyfill {
            data;
            width;
            height;
            constructor(data, width, height) {
                this.data = data;
                this.width = width;
                this.height = height;
            }
        }
        g.ImageData = ImageDataPolyfill;
    }
    if (!g.Image) {
        class ImagePolyfill {
            width = 0;
            height = 0;
            src = '';
            onload = null;
            onerror = null;
            decode() {
                return Promise.resolve();
            }
        }
        g.Image = ImagePolyfill;
    }
}
export default ensureCanvasPolyfills;
