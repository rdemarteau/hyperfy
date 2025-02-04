import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { fork } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'

const dev = process.argv.includes('--dev')
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, './')
const buildDir = path.join(rootDir, 'build')

await fs.emptyDir(buildDir)

/**
 * Build Client
 */
const clientPublicDir = path.join(rootDir, 'src/client/public')
const clientBuildDir = path.join(rootDir, 'build/public')
const clientHtmlSrc = path.join(rootDir, 'src/client/public/index.html')
const clientHtmlDest = path.join(rootDir, 'build/public/index.html')

{
  const clientCtx = await esbuild.context({
    entryPoints: ['src/client/index.js'],
    entryNames: '/[name]-[hash]',
    outdir: clientBuildDir,
    platform: 'browser',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    metafile: true,
    jsx: 'automatic',
    jsxImportSource: '@firebolt-dev/jsx',
    define: {
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
      'process.env.CLIENT': 'true',
      'process.env.SERVER': 'false',
      'process': JSON.stringify({
        env: {
          NODE_ENV: dev ? 'development' : 'production'
        }
      })
    },
    loader: {
      '.js': 'jsx',
      '.physx.js': 'js', // Treat PhysX script differently
    },
    resolve: {
      alias: {
        'physx-js-webidl': path.join(rootDir, 'src/server/physx/physx-js-webidl.js')
      }
    },
    plugins: [
      {
        name: 'physx-plugin',
        setup(build) {
          // Ensure PhysX script is treated as a module
          build.onLoad({ filter: /physx-js-webidl\.js$/ }, async (args) => {
            const contents = await fs.readFile(args.path, 'utf8');
            return {
              contents: contents.replace('import.meta.url', 'URL.createObjectURL(new Blob([]))'),
              loader: 'js',
            };
          });
        }
      },
      {
        name: 'client-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            // Copy over public files
            await fs.copy(clientPublicDir, clientBuildDir)

            // Explicitly copy env.js and physx files
            const envJsSrc = path.join(clientPublicDir, 'env.js')
            const envJsDest = path.join(buildDir, 'env.js')
            const physxJsSrc = path.join(rootDir, 'src/server/physx/physx-js-webidl.js')
            const physxJsDest = path.join(buildDir, 'physx-js-webidl.js')

            if (await fs.pathExists(envJsSrc)) {
              await fs.copy(envJsSrc, envJsDest)
            }
            if (await fs.pathExists(physxJsSrc)) {
              await fs.copy(physxJsSrc, physxJsDest)
            }

            // Find js output file
            const metafile = result.metafile
            const outputFiles = Object.keys(metafile.outputs)
            const jsFile = outputFiles.find(file => file.endsWith('.js')).split('build/public')[1]

            // Inject into html and copy over
            let htmlContent = await fs.readFile(clientHtmlSrc, 'utf-8')
            htmlContent = htmlContent.replace('{jsFile}', jsFile)
            htmlContent = htmlContent.replaceAll('{buildId}', Date.now())
            await fs.writeFile(clientHtmlDest, htmlContent)
          })
        },
      },
    ],
  })

  if (dev) {
    await clientCtx.watch()
  } else {
    await clientCtx.rebuild()
  }  
}

/**
 * Build Server
 */
let spawn
{
  const serverCtx = await esbuild.context({
    entryPoints: ['src/server/index.js'],
    outfile: 'build/index.js',
    platform: 'node',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    packages: 'external',
    define: {
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
      'process.env.CLIENT': 'false',
      'process.env.SERVER': 'true',
      'process': JSON.stringify({
        env: {
          NODE_ENV: dev ? 'development' : 'production'
        }
      })
    },
    plugins: [
      {
        name: 'server-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            // Copy over physx wasm
            const physxWasmSrc = path.join(rootDir, 'src/server/physx/physx-js-webidl.wasm')
            const physxWasmDest = path.join(rootDir, 'build/physx-js-webidl.wasm')
            await fs.copy(physxWasmSrc, physxWasmDest)

            // Only handle dev mode server
            if (dev) {
              spawn?.kill('SIGTERM')
              spawn = fork(path.join(rootDir, 'build/index.js'))
            } else {
              process.exit(0)
            }
          })
        },
      },
    ],
    loader: {},
  })

  if (dev) {
    await serverCtx.watch()
  } else {
    await serverCtx.rebuild()
  }
}
