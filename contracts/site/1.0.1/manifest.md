# web-simple client manifest

Policy 1.0.1; SHA-256 485b617e8d9836d43a194c4cf6fc611725713d45124d26cf6ee06f56df26e130.

Contract and local validators only; no sale, checkout, hosting activation or visual-fidelity verification.

Client understands intent, prepares copy/images, creates a catalog-expressible preview and obtains human approval before sending the spec and separate asset bytes.

Validate JSON and references with validateSiteSpec; verify the complete supplied image bundle with validateAssets. Both must succeed. For changes, validateChangeRequest returns a candidate spec; verify its complete resulting asset bundle before accepting it.

Copy is literal data. Rich text uses typed nodes. Renderers must escape copy; no raw HTML, scripts, styles, prompts or free-text instructions are supported.

Recursively sort object keys using JavaScript default string order, preserve array order and JSON scalar serialization, emit compact UTF-8 JSON, exclude only the top-level approval property, then SHA-256. No Unicode normalization. Preview, when present, is included. Not RFC 8785.

approved=true plus a canonical UTC timestamp and matching result digest is a declaration, not authenticated proof. Authentication must later bind the approving human.

Optional artifactId/sha256 only; never fetched or executed. Previews must use this component catalog and tokens. Contract validation cannot prove visual identity.

Typed operations target stable IDs. A block ID is edited at most once. New pages are complete and cannot be edited again in the same request. Section containers persist. New assets use new IDs; an updated block references the new ID. Historical assets cannot be overwritten or removed in v1.

All blocks in add-page count; SEO counts one distinct page; token/navigation/footer edits use the separate global cap. Successful applied requests count once in the trusted UTC-month ledger. Validation performs no reservation, persistence or idempotency. CMS content edits use a later separate CMS path.

Use the exact pinned policy version; no latest-version fallback. effectiveDate does not activate a plan or migrate clients.

## Limits and rationale

| Policy rule | Value | Rationale |
| --- | --- | --- |
| `/planId` | `"web-simple"` | One bounded pilot plan; no price or checkout. |
| `/version` | `"1.0.1"` | Nonfunctional rationale correction; all catalog limits remain unchanged. |
| `/effectiveDate` | `"2026-10-06"` | Initial policy date; activation/enrollment is a later responsibility. |
| `/includes/capabilities` | `["static-astro","pocketbase-cms"]` | Owner-approved pilot architecture; no custom server code. |
| `/includes/maxPages` | `7` | Seven authored-page slots provide bounded headroom for a small catalog website. |
| `/includes/system404Counts` | `false` | Generated system 404 is outside the authored-page allowance. |
| `/includes/ssl` | `true` | Owner requires SSL with hosting; contract inclusion is not deployment evidence. |
| `/includes/domain` | `"client-supplied"` | Client brings their own domain; no domain sale. |
| `/includes/cmsCollections` | `["catalog","blog","announcements"]` | Only the three approved optional content collections. |
| `/includes/excludes` | `["custom-backend","end-user-auth","checkout","research","ocr","image-editing","custom-script","custom-style","raw-html","arbitrary-component","uploaded-svg"]` | Work stays within deterministic templates and prepared client materials. |
| `/firstVersion/contractVersion` | `"1.0"` | Separate wire-contract version from policy semver. |
| `/firstVersion/structure/maxSectionsPerPage` | `12` | Bounded headroom for catalog landing sections. |
| `/firstVersion/structure/maxBlocksPerSection` | `6` | Bounded composable sections. |
| `/firstVersion/structure/maxBlocksPerPage` | `30` | Bounds aggregate page complexity. |
| `/firstVersion/structure/maxJsonBytes` | `262144` | Bounds parsing and validation work before semantic traversal. |
| `/firstVersion/structure/idPattern` | `"^[a-z][a-z0-9-]{0,63}$"` | Stable ASCII IDs; no path fragments or prototype keys. |
| `/firstVersion/structure/pagePathPattern` | `"^/(?:[a-z0-9]+(?:-[a-z0-9]+)*/){0,3}$"` | Canonical trailing-slash routes with at most three safe segments. |
| `/firstVersion/structure/reservedPaths` | `["/404/","/assets/","/api/"]` | System error, asset and service namespaces cannot be authored pages. |
| `/firstVersion/copy/heading` | `120` | Bounded heading text. |
| `/firstVersion/copy/shortCopy` | `500` | Bounded introductions and summaries. |
| `/firstVersion/copy/paragraph` | `2000` | Supports detailed text without unbounded paragraphs. |
| `/firstVersion/copy/richText` | `8000` | Allows small articles and legal content. |
| `/firstVersion/copy/label` | `80` | Readable navigation and CTA labels. |
| `/firstVersion/copy/alt` | `240` | Concise descriptive accessible image text. |
| `/firstVersion/copy/seoTitle` | `70` | Predictable page metadata. |
| `/firstVersion/copy/seoDescription` | `200` | Predictable page description. |
| `/firstVersion/items/grid` | `12` | Small grids and ordered lists. |
| `/firstVersion/items/faq` | `20` | Headroom for common marketing FAQs. |
| `/firstVersion/components/hero/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/rich-text/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/feature-grid/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/steps/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/link-cards/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/gallery/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/faq/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/cta/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/contact/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/catalog/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/blog/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/components/announcements/variants` | `["standard"]` | One deterministic initial template variant. |
| `/firstVersion/designTokens/colorSlots` | `["background","surface","text","muted","primary","accent","border"]` | Seven semantic color roles without copying client branding. |
| `/firstVersion/designTokens/colorPattern` | `"^#[0-9A-Fa-f]{6}$"` | Literal RGB values only; no CSS expressions. |
| `/firstVersion/designTokens/fonts` | `["Inter","EB Garamond","system-sans","system-serif"]` | Reference fonts plus no-download system alternatives. |
| `/firstVersion/designTokens/spacing` | `[4,8,12,16,24,32,48,64,96]` | Fixed reusable spacing scale. |
| `/firstVersion/designTokens/radius` | `[0,2,4,8,16,24]` | Restrained template rounding. |
| `/firstVersion/navigation/maxPrimary` | `8` | Fits small-site primary navigation. |
| `/firstVersion/navigation/maxFooter` | `12` | Allows legal and supporting links. |
| `/firstVersion/navigation/externalSchemes` | `["https:","mailto:","tel:"]` | Explicit link protocols without script URLs or third-party embeds. |
| `/firstVersion/images/formats` | `["webp","jpeg","png"]` | Matches supplied reference raster assets; uploaded SVG excluded. |
| `/firstVersion/images/maxAssets` | `50` | Headroom over 28 reference image/brand files. |
| `/firstVersion/images/maxBytes` | `2097152` | Headroom over the 88,270-byte reference maximum. |
| `/firstVersion/images/maxTotalBytes` | `26214400` | Bounds the whole supplied bundle. |
| `/firstVersion/images/maxWidth` | `4096` | Headroom over reference width 1600. |
| `/firstVersion/images/maxHeight` | `4096` | Headroom over reference height 1900. |
| `/firstVersion/images/animated` | `false` | Static templates only. |
| `/firstVersion/images/altRequired` | `true` | Every image needs descriptive accessible copy. |
| `/firstVersion/images/hash` | `"sha256"` | Binds each declaration to actual supplied bytes. |
| `/firstVersion/approval/required` | `true` | Client human approves before submission. |
| `/firstVersion/approval/digest` | `"sha256-sorted-json-without-approval"` | Binds declaration to exact proposed result, including optional preview reference. |
| `/firstVersion/approval/previewRequired` | `false` | Preview artifact reference is optional; approval declaration is required. |
| `/changes/perMonth` | `4` | Selected bounded pilot allowance. |
| `/changes/calendar` | `"UTC"` | Unambiguous calendar-month boundary. |
| `/changes/rollover` | `false` | Unused requests do not accumulate. |
| `/changes/countsWhen` | `"successfully-applied"` | Validation, rejected work and retries are not new applied requests. |
| `/changes/maxPagesTouched` | `2` | Selected per-request page cap. |
| `/changes/maxBlocksModified` | `10` | Selected per-request block cap; additions to new pages count. |
| `/changes/maxGlobalOperations` | `1` | Shared configuration has a separate allowance. |
| `/changes/maxOperations` | `20` | Bounds processing independently of final change size. |
| `/changes/operations` | `["add-block","update-block","remove-block","add-page","update-page-seo","update-tokens","update-navigation"]` | Typed bounded changes; no arbitrary patches, page deletion or renaming. |
| `/changes/doesNotCount` | `["pocketbase-content-edit"]` | Content-only CMS edits do not change the static site contract. |

## Components

- **hero**: variants standard; heading: heading (required); text: shortCopy (required); image: image (optional); action: link (optional).
- **rich-text**: variants standard; content: richText (required).
- **feature-grid**: variants standard; heading: heading (required); items: textItems (required).
- **steps**: variants standard; heading: heading (required); items: textItems (required).
- **link-cards**: variants standard; heading: heading (required); items: linkItems (required).
- **gallery**: variants standard; heading: heading (required); images: imageItems (required).
- **faq**: variants standard; heading: heading (required); items: faqItems (required).
- **cta**: variants standard; heading: heading (required); text: shortCopy (required); action: link (required).
- **contact**: variants standard; heading: heading (required); text: shortCopy (required); links: links (required).
- **catalog**: variants standard; heading: heading (required); collection: catalogCollection (required); emptyText: shortCopy (required).
- **blog**: variants standard; heading: heading (required); collection: blogCollection (required); emptyText: shortCopy (required).
- **announcements**: variants standard; heading: heading (required); collection: announcementsCollection (required); emptyText: shortCopy (required).

## Examples

All content and pixels are fictional. No links are fetched.

Site spec:

```json
{
  "contractVersion": "1.0",
  "planId": "web-simple",
  "policyVersion": "1.0.1",
  "pages": [
    {
      "id": "home",
      "path": "/",
      "seo": {
        "title": "Fictional guide — home",
        "description": "Offline demonstration using fictional content and original generated pixels."
      },
      "sections": [
        {
          "id": "section-0",
          "blocks": [
            {
              "id": "block-0",
              "component": "hero",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "text": "Prepared by a fictional client for this offline example.",
                "image": "fictional-pixel",
                "action": {
                  "label": "Explore",
                  "pageId": "home"
                }
              }
            }
          ]
        },
        {
          "id": "section-1",
          "blocks": [
            {
              "id": "block-1",
              "component": "rich-text",
              "variant": "standard",
              "props": {
                "content": [
                  {
                    "type": "paragraph",
                    "text": "Fictional community information."
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "section-2",
          "blocks": [
            {
              "id": "block-2",
              "component": "feature-grid",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "items": [
                  {
                    "heading": "A prepared step",
                    "text": "Use supplied facts."
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "section-3",
          "blocks": [
            {
              "id": "block-3",
              "component": "steps",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "items": [
                  {
                    "heading": "A prepared step",
                    "text": "Use supplied facts."
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "section-4",
          "blocks": [
            {
              "id": "block-4",
              "component": "link-cards",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "items": [
                  {
                    "heading": "Explore a neighborhood",
                    "text": "An offline example.",
                    "link": {
                      "label": "Explore",
                      "pageId": "home"
                    }
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "section-5",
          "blocks": [
            {
              "id": "block-5",
              "component": "gallery",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "images": [
                  "fictional-pixel"
                ]
              }
            }
          ]
        },
        {
          "id": "section-6",
          "blocks": [
            {
              "id": "block-6",
              "component": "faq",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "items": [
                  {
                    "question": "How do we start?",
                    "answer": "Prepare the materials and approve the result."
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "section-7",
          "blocks": [
            {
              "id": "block-7",
              "component": "cta",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "text": "Prepared by a fictional client for this offline example.",
                "action": {
                  "label": "Explore",
                  "pageId": "home"
                }
              }
            }
          ]
        },
        {
          "id": "section-8",
          "blocks": [
            {
              "id": "block-8",
              "component": "contact",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "text": "Prepared by a fictional client for this offline example.",
                "links": [
                  {
                    "label": "Explore",
                    "pageId": "home"
                  }
                ]
              }
            }
          ]
        },
        {
          "id": "section-9",
          "blocks": [
            {
              "id": "block-9",
              "component": "catalog",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "collection": "catalog",
                "emptyText": "Prepared by a fictional client for this offline example."
              }
            }
          ]
        },
        {
          "id": "section-10",
          "blocks": [
            {
              "id": "block-10",
              "component": "blog",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "collection": "blog",
                "emptyText": "Prepared by a fictional client for this offline example."
              }
            }
          ]
        },
        {
          "id": "section-11",
          "blocks": [
            {
              "id": "block-11",
              "component": "announcements",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "collection": "announcements",
                "emptyText": "Prepared by a fictional client for this offline example."
              }
            }
          ]
        }
      ]
    },
    {
      "id": "about",
      "path": "/about/",
      "seo": {
        "title": "Fictional guide — about",
        "description": "Offline demonstration using fictional content and original generated pixels."
      },
      "sections": [
        {
          "id": "section-0",
          "blocks": [
            {
              "id": "block-0",
              "component": "rich-text",
              "variant": "standard",
              "props": {
                "content": [
                  {
                    "type": "paragraph",
                    "text": "Fictional community information."
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "id": "north",
      "path": "/north/",
      "seo": {
        "title": "Fictional guide — north",
        "description": "Offline demonstration using fictional content and original generated pixels."
      },
      "sections": [
        {
          "id": "section-0",
          "blocks": [
            {
              "id": "block-0",
              "component": "feature-grid",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "items": [
                  {
                    "heading": "A prepared step",
                    "text": "Use supplied facts."
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "id": "south",
      "path": "/south/",
      "seo": {
        "title": "Fictional guide — south",
        "description": "Offline demonstration using fictional content and original generated pixels."
      },
      "sections": [
        {
          "id": "section-0",
          "blocks": [
            {
              "id": "block-0",
              "component": "steps",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "items": [
                  {
                    "heading": "A prepared step",
                    "text": "Use supplied facts."
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "id": "west",
      "path": "/west/",
      "seo": {
        "title": "Fictional guide — west",
        "description": "Offline demonstration using fictional content and original generated pixels."
      },
      "sections": [
        {
          "id": "section-0",
          "blocks": [
            {
              "id": "block-0",
              "component": "link-cards",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "items": [
                  {
                    "heading": "Explore a neighborhood",
                    "text": "An offline example.",
                    "link": {
                      "label": "Explore",
                      "pageId": "home"
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "id": "privacy",
      "path": "/privacy/",
      "seo": {
        "title": "Fictional guide — privacy",
        "description": "Offline demonstration using fictional content and original generated pixels."
      },
      "sections": [
        {
          "id": "section-0",
          "blocks": [
            {
              "id": "block-0",
              "component": "gallery",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "images": [
                  "fictional-pixel"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "id": "contact",
      "path": "/contact/",
      "seo": {
        "title": "Fictional guide — contact",
        "description": "Offline demonstration using fictional content and original generated pixels."
      },
      "sections": [
        {
          "id": "section-0",
          "blocks": [
            {
              "id": "block-0",
              "component": "faq",
              "variant": "standard",
              "props": {
                "heading": "Fictional neighborhood guide",
                "items": [
                  {
                    "question": "How do we start?",
                    "answer": "Prepare the materials and approve the result."
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ],
  "tokens": {
    "colors": {
      "background": "#FAFAFA",
      "surface": "#EEEEEE",
      "text": "#222222",
      "muted": "#555555",
      "primary": "#334455",
      "accent": "#557799",
      "border": "#CCCCCC"
    },
    "fonts": {
      "heading": "Inter",
      "body": "Inter"
    },
    "spacing": 4,
    "radius": 0
  },
  "navigation": {
    "primary": [
      {
        "label": "Explore",
        "pageId": "home"
      }
    ],
    "footer": [
      {
        "label": "Explore",
        "pageId": "home"
      }
    ]
  },
  "assets": [
    {
      "id": "fictional-pixel",
      "format": "png",
      "bytes": 70,
      "width": 1,
      "height": 1,
      "alt": "Fictional demonstration pixel",
      "sha256": "e170956d97f8838503784272b9c3f916bcc8cab2289cfca8b1b578645c05d95c"
    }
  ],
  "cms": {
    "collections": [
      "catalog",
      "blog",
      "announcements"
    ]
  },
  "approval": {
    "approved": true,
    "approvedAt": "2026-10-06T12:00:00.000Z",
    "specSha256": "4b395ef19bf98f12fae8b2f989aa28c334b99071114fc96d28097e0229c204c7"
  }
}
```

Change request:

```json
{
  "contractVersion": "1.0",
  "planId": "web-simple",
  "policyVersion": "1.0.1",
  "baseSpecSha256": "4b395ef19bf98f12fae8b2f989aa28c334b99071114fc96d28097e0229c204c7",
  "operations": [
    {
      "op": "update-block",
      "pageId": "home",
      "sectionId": "section-0",
      "blockId": "block-0",
      "block": {
        "id": "block-0",
        "component": "hero",
        "variant": "standard",
        "props": {
          "heading": "A revised fictional welcome",
          "text": "Prepared by a fictional client for this offline example.",
          "image": "fictional-pixel",
          "action": {
            "label": "Explore",
            "pageId": "home"
          }
        }
      }
    }
  ],
  "assets": [],
  "approval": {
    "approved": true,
    "approvedAt": "2026-10-06T12:00:00.000Z",
    "specSha256": "98e3ef6caa7837333698dae6816098f3a2dedafd1ed1e730a8f0621ce4639689"
  }
}
```
