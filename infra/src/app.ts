import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as dns from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Email } from './email.js';
import { Runtime } from './runtime.js';
import { Controls } from './controls.js';

export type Config = { account: string; region: string; zoneId: string; ownerEmail: string; limits?:Record<string,number> };
export const app = new cdk.App();
const config: Config = JSON.parse(readFileSync(resolve(process.env.A2AVIARY_CONFIG ?? '../.local/deploy.json'), 'utf8'));
const defaultLimits=JSON.parse(readFileSync(resolve('../contracts/limits.defaults.json'),'utf8'));
for(const [key,value]of Object.entries(config.limits??{}))if(!(key in defaultLimits) || !Number.isInteger(value) || value<1 || value>defaultLimits[key])throw new Error('Invalid operating limit: '+key);
if (config.region !== 'us-east-1') throw new Error('The release requires us-east-1');
const env = { account: config.account, region: config.region };

class Website extends cdk.Stack {
  bucket: s3.Bucket; releases: s3.Bucket; distribution: cf.Distribution;
  constructor(scope: Construct, id: string) {
    super(scope, id, { env, terminationProtection: true });
    const zone = dns.HostedZone.fromHostedZoneAttributes(this, 'Zone', { hostedZoneId: config.zoneId, zoneName: 'a2aviary.io' });
    this.bucket = new s3.Bucket(this, 'Website', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, versioned: true, encryption: s3.BucketEncryption.S3_MANAGED, removalPolicy: cdk.RemovalPolicy.RETAIN });
    this.releases = new s3.Bucket(this, 'Releases', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, versioned: true, encryption: s3.BucketEncryption.S3_MANAGED, removalPolicy: cdk.RemovalPolicy.RETAIN });
    const certificate = new acm.Certificate(this, 'Certificate', { domainName: 'a2aviary.io', validation: acm.CertificateValidation.fromDns(zone) });
    const headers = new cf.ResponseHeadersPolicy(this, 'Headers', { securityHeadersBehavior: {
      contentSecurityPolicy: { contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", override: true },
      contentTypeOptions: { override: true }, frameOptions: { frameOption: cf.HeadersFrameOption.DENY, override: true },
      referrerPolicy: { referrerPolicy: cf.HeadersReferrerPolicy.NO_REFERRER, override: true },
      strictTransportSecurity: { accessControlMaxAge: cdk.Duration.days(365), override: true },
    }});
    const origin = S3BucketOrigin.withOriginAccessControl(this.bucket);
    const mutable = new cf.CachePolicy(this, 'Mutable', { minTtl: cdk.Duration.seconds(0), defaultTtl: cdk.Duration.seconds(0), maxTtl: cdk.Duration.days(1), enableAcceptEncodingGzip: true, enableAcceptEncodingBrotli: true });
    this.distribution = new cf.Distribution(this, 'Distribution', { certificate, domainNames: ['a2aviary.io'], defaultRootObject: 'index.html', priceClass: cf.PriceClass.PRICE_CLASS_100,
      defaultBehavior: { origin, viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: mutable, responseHeadersPolicy: headers, compress: true },
      additionalBehaviors: { '/assets/*': { origin, viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED, responseHeadersPolicy: headers, compress: true } },
    });
    for (const kind of ['A', 'AAAA']) {
      const props = { zone, target: dns.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)) };
      if (kind === 'A') new dns.ARecord(this, kind, props); else new dns.AaaaRecord(this, kind, props);
    }
    new cdk.CfnOutput(this, 'WebsiteBucket', { value: this.bucket.bucketName });
    new cdk.CfnOutput(this, 'ReleaseBucket', { value: this.releases.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
    new cdk.CfnOutput(this, 'WebsiteUrl', { value: 'https://a2aviary.io' });
  }
}
const website = new Website(app, 'a2aviary-prod-website');
const ci = new cdk.Stack(app, 'a2aviary-prod-ci', { env, terminationProtection: true });
const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(ci, 'GitHubOidc', `arn:aws:iam::${config.account}:oidc-provider/token.actions.githubusercontent.com`);
const deployRole = new iam.Role(ci, 'WebsiteDeployment', { assumedBy: new iam.OpenIdConnectPrincipal(provider, { StringEquals: {
  'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
  'token.actions.githubusercontent.com:sub': 'repo:carlos-olivera@1182541/a2aviary@1403745581:ref:refs/heads/main',
}}), maxSessionDuration: cdk.Duration.hours(1) });
for (const bucket of [website.bucket, website.releases]) {
  deployRole.addToPolicy(new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [bucket.bucketArn] }));
  deployRole.addToPolicy(new iam.PolicyStatement({ actions: ['s3:PutObject', 's3:GetObject', 's3:GetObjectVersion'], resources: [bucket.arnForObjects('*')] }));
}
deployRole.addToPolicy(new iam.PolicyStatement({ actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation', 'cloudfront:GetDistribution'], resources: [`arn:aws:cloudfront::${config.account}:distribution/${website.distribution.distributionId}`] }));
new cdk.CfnOutput(ci, 'WebsiteDeploymentRole', { value: deployRole.roleArn });
cdk.Tags.of(app).add('Project', 'a2aviary'); cdk.Tags.of(app).add('Environment', 'prod'); cdk.Tags.of(app).add('Owner', 'Carlos Olivera');

const email = new Email(app, 'a2aviary-prod-email', config);
const runtime = new Runtime(app, 'a2aviary-prod-runtime', config, email);
new Controls(app, 'a2aviary-prod-controls', config, email, runtime);

app.synth();
