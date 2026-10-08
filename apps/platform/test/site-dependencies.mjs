import {
  canonicalJson,
  sha256,
  SiteError,
  VerificationFailure
} from '@a2aviary/generator';
export function testDependencies() {
  const data = new Map();
  let failAssets = false,
    failReset = false;
  const inputs = [],
    contexts = [],
    resets = [];
  let verifies = 0,
    deploys = 0,
    failVerify = false,
    failDeploy = false,
    unknown = false;
  return {
    key: 'a'.repeat(64),
    objects: {
      async put(k, b) {
        data.set(k, Buffer.from(b));
      },
      async deletePrefix(prefix) {
        if (failAssets) throw new SiteError('asset_reset_failed');
        for (const k of data.keys()) if (k.startsWith(prefix)) data.delete(k);
      },
      async get(k) {
        if (!data.has(k)) throw Error('missing');
        return data.get(k);
      }
    },
    verifier: {
      async verify(source, spec, preview, context) {
        verifies++;
        contexts.push(context);
        const files = {};
        for (const p of spec.pages)
          files[
            p.path === '/' ? 'index.html' : p.path.slice(1) + 'index.html'
          ] = Buffer.from('Fictional provider test double').toString('base64');
        for (const [p, b] of Object.entries(source.binaryFiles))
          files[p.slice(7)] = b;
        const checks = [
          'catalog-syntax',
          'astro-build',
          ...spec.pages.flatMap((p) => [
            'a11y:' + p.path,
            'links:' + p.path,
            'lighthouse:' + p.path,
            'visual:' + p.path + ':390',
            'visual:' + p.path + ':1280'
          ])
        ].map((name) => ({
          name,
          passed: !failVerify,
          details: { testDouble: true }
        }));
        const build = {
          files,
          report: {
            version: 1,
            passed: !failVerify,
            sourceSha256: source.sourceSha256,
            specSha256: source.specSha256,
            outputSha256: sha256(canonicalJson(files)),
            checks
          },
          artifacts: {},
          sessionId: 'fictional-session'
        };
        build.artifacts['report.json'] = Buffer.from(
          JSON.stringify(build.report)
        ).toString('base64');
        if (failVerify) throw new VerificationFailure(build);
        return build;
      }
    },
    deployer: {
      async usage(resources,name,period){return {currency:'USD',period,status:'unavailable',basis:'unavailable',amount:null,reason:'fictional_provider_no_billing',metrics:null,metricsStatus:'unavailable'};},
      async deploy(input) {
        deploys++;
        inputs.push(input);
        if (failDeploy)
          throw new SiteError(
            unknown ? 'deployment_outcome_unknown' : 'deployment_failed'
          );
        const resources = {
          projectId: 'fictional-project',
          environmentId: 'fixture',
          webServiceId: 'web',
          cmsServiceId: 'cms',
          domain: 'fictional-fixture.up.railway.app',
          test: input.test === true,
          cmsConfigured: true
        };
        await input.saveResources(resources);
        return resources;
      },
      async reset(resources, name, test) {
        resets.push({ resources, name, test });
        if (failReset) throw new SiteError('test_reset_unconfirmed');
      },
      async status() {
        return { testDouble: true };
      }
    },
    data,
    inputs,
    contexts,
    resets,
    failAssetCleanup(value) {
      failAssets = value;
    },
    failReset(value) {
      failReset = value;
    },
    get counts() {
      return { verifies, deploys };
    },
    failVerification(v) {
      failVerify = v;
    },
    failDeployment(v, u = false) {
      failDeploy = v;
      unknown = u;
    }
  };
}
