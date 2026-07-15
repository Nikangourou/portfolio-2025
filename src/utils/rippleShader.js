const injectBaseRippleVertexShader = ({
    shader,
    vertexPrefix,
    vertexSetup,
    bendBase,
    bendBoost,
    offsetScale,
}) => {
    shader.vertexShader = `${vertexPrefix}\n${shader.vertexShader}`

    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
      #include <begin_vertex>

      ${vertexSetup}

      float cursorDistance = distance(position.xy, uRippleCursor);
      float cursorField = smoothstep(1.45, 0.0, cursorDistance) * uRippleStrength;
      float rippleField = cursorField;

      vec2 cursorVector = position.xy - uRippleCursor;
      float cursorRadius = max(length(cursorVector), 0.0001);
      vec2 cursorDirection = cursorVector / cursorRadius;

      float cursorRipple = sin(cursorRadius * 20.0 - uTime * 9.0);
      float cursorEnvelope = exp(-cursorRadius * 2.8);
      float sheetBias = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * 2.0 - 1.0) * 0.55);
      float ripple = cursorRipple * cursorEnvelope * cursorField;
      float bend = ripple * (${bendBase} + sheetBias * ${bendBoost});

      transformed.z += bend;
      transformed.x += cursorDirection.x * rippleField * ${offsetScale} * cursorEnvelope;
      transformed.y += cursorDirection.y * rippleField * ${offsetScale} * cursorEnvelope;

      vRippleMask = clamp(abs(ripple) * 2.2 + rippleField * 0.3, 0.0, 1.0);
      vRipplePhase = ripple;
    `,
    )
}

const injectBaseRippleFragmentFooter = ({
    shader,
    fragmentPrefix,
    fragmentSetup = '',
    tintStrength,
    shimmerStrength,
    mixStrength,
    ringStrength,
    centerBoost = false,
}) => {
    shader.fragmentShader = `${fragmentPrefix}\n${shader.fragmentShader}`

    if (fragmentSetup) {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            fragmentSetup,
        )
    }

    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
      float rippleHighlight = smoothstep(0.12, 1.0, vRippleMask);
      float shimmer = 0.5 + 0.5 * sin(uTime * 4.5 + vRippleUv.y * 22.0 + vRippleUv.x * 10.0);
      ${centerBoost ? 'float centerBias = smoothstep(0.08, 0.92, 1.0 - distance(vRippleUv, vec2(0.5)) * 1.2);' : ''}
      float ringLine = smoothstep(0.35, 0.95, 0.5 + 0.5 * vRipplePhase);
      vec3 rippleTint = mix(gl_FragColor.rgb, uRippleTint, rippleHighlight * (${tintStrength} + shimmer * ${shimmerStrength}));

      gl_FragColor.rgb = mix(gl_FragColor.rgb, rippleTint, rippleHighlight * ${mixStrength});
      gl_FragColor.rgb += ringLine * rippleHighlight * ${ringStrength}${centerBoost ? ' * (0.65 + centerBias * 0.35)' : ''};

      #include <dithering_fragment>
    `,
    )
}

export const applyProjectRippleShader = (material, rippleUniforms) => {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uRippleCursor = rippleUniforms.uRippleCursor
        shader.uniforms.uRippleStrength = rippleUniforms.uRippleStrength
        shader.uniforms.uRippleTint = rippleUniforms.uRippleTint
        shader.uniforms.uFrontMap = rippleUniforms.uFrontMap
        shader.uniforms.uBackMap = rippleUniforms.uBackMap
        shader.uniforms.uBackFlipX = rippleUniforms.uBackFlipX
        shader.uniforms.uBackFlipY = rippleUniforms.uBackFlipY
        shader.uniforms.uFrontMapTransform = rippleUniforms.uFrontMapTransform
        shader.uniforms.uBackMapTransform = rippleUniforms.uBackMapTransform
        shader.uniforms.uTime = rippleUniforms.uTime

        material.userData.shader = shader

        injectBaseRippleVertexShader({
            shader,
            vertexPrefix: `
        uniform vec2 uRippleCursor;
        uniform float uRippleStrength;
        uniform float uTime;
        uniform mat3 uFrontMapTransform;
        uniform mat3 uBackMapTransform;
        varying vec2 vFrontUv;
        varying vec2 vBackUv;
        varying vec2 vRippleUv;
        varying float vRippleMask;
        varying float vRipplePhase;
      `,
            vertexSetup: `
        vFrontUv = (uFrontMapTransform * vec3(uv, 1.0)).xy;
        vec2 backFaceUv = vec2(uv.x, 1.0 - uv.y);
        vBackUv = (uBackMapTransform * vec3(backFaceUv, 1.0)).xy;
        vRippleUv = uv;
      `,
            bendBase: '0.12',
            bendBoost: '0.08',
            offsetScale: '0.035',
        })

        injectBaseRippleFragmentFooter({
            shader,
            fragmentPrefix: `
        uniform sampler2D uFrontMap;
        uniform sampler2D uBackMap;
        uniform float uBackFlipX;
        uniform float uBackFlipY;
        uniform vec3 uRippleTint;
        uniform float uTime;
        varying vec2 vFrontUv;
        varying vec2 vBackUv;
        varying vec2 vRippleUv;
        varying float vRippleMask;
        varying float vRipplePhase;
      `,
            fragmentSetup: `
        float sampledBackX = mix(vBackUv.x, 1.0 - vBackUv.x, uBackFlipX);
        float sampledBackY = mix(vBackUv.y, 1.0 - vBackUv.y, uBackFlipY);
        vec2 backSampleUv = vec2(sampledBackX, sampledBackY);
        vec4 sampledDiffuseColor = gl_FrontFacing
          ? texture2D(uFrontMap, vFrontUv)
          : texture2D(uBackMap, backSampleUv);

        diffuseColor *= sampledDiffuseColor;
      `,
            tintStrength: '0.16',
            shimmerStrength: '0.08',
            mixStrength: '0.52',
            ringStrength: '0.08',
            centerBoost: true,
        })
    }

    material.customProgramCacheKey = () => 'pressure-ripple-v3'
    material.needsUpdate = true
}

export const applyBorderRippleShader = (material, rippleUniforms) => {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uRippleCursor = rippleUniforms.uRippleCursor
        shader.uniforms.uRippleStrength = rippleUniforms.uRippleStrength
        shader.uniforms.uRippleTint = rippleUniforms.uRippleTint
        shader.uniforms.uTime = rippleUniforms.uTime

        injectBaseRippleVertexShader({
            shader,
            vertexPrefix: `
        uniform vec2 uRippleCursor;
        uniform float uRippleStrength;
        uniform float uTime;
        varying vec2 vRippleUv;
        varying float vRippleMask;
        varying float vRipplePhase;
      `,
            vertexSetup: 'vRippleUv = uv;',
            bendBase: '0.08',
            bendBoost: '0.06',
            offsetScale: '0.025',
        })

        injectBaseRippleFragmentFooter({
            shader,
            fragmentPrefix: `
        uniform vec3 uRippleTint;
        uniform float uTime;
        varying vec2 vRippleUv;
        varying float vRippleMask;
        varying float vRipplePhase;
      `,
            tintStrength: '0.14',
            shimmerStrength: '0.06',
            mixStrength: '0.46',
            ringStrength: '0.08',
        })
    }

    material.customProgramCacheKey = () => 'border-pressure-ripple-v3'
    material.needsUpdate = true
}