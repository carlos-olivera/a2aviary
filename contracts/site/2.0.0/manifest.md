# web-simple client manifest

Policy 2.0.0; SHA-256 8e9ce84ca78de09002e49278d525e7426b82e5ae41f0d83c88f696e947f436da.

Prepared source only. Nothing is for sale; no live checkout or active Paddle merchant of record.

Build a server draft incrementally through MCP. Upload bytes out of band through one agent/human upload session. Only server-normalized assets enter the spec.

Hash compact UTF-8 JSON with recursively sorted object keys and preserved array order. Include the entire canonical spec. No Unicode normalization.

A verified owner or enabled site administrator approves a verified server snapshot through the browser. Approval binds the spec and output hashes and draft revision. No MCP approval.

Server-generated, sandbox-verified artifact and screenshots; deployment uses these exact bytes without rebuilding.

change_requests_unavailable. CMS content edits remain available directly through PocketBase.

Policy 2.0.0 and site contract 2.0 replace intake. Historical policies are frozen, retired artifacts.

## Limits and rationale

| Policy rule | Value | Rationale |
| --- | --- | --- |
| `/planId` | `"web-simple"` | One bounded pilot plan; no price or checkout. |
| `/version` | `"2.0.0"` | Nonfunctional rationale correction; all catalog limits remain unchanged. |
| `/effectiveDate` | `"2026-10-08"` | Initial policy date; activation/enrollment is a later responsibility. |
| `/includes/capabilities` | `["static-astro","pocketbase-cms"]` | Owner-approved pilot architecture; no custom server code. |
| `/includes/maxPages` | `7` | Seven authored-page slots provide bounded headroom for a small catalog website. |
| `/includes/system404Counts` | `false` | Generated system 404 is outside the authored-page allowance. |
| `/includes/ssl` | `true` | Owner requires SSL with hosting; contract inclusion is not deployment evidence. |
| `/includes/domain` | `"client-supplied"` | Client brings their own domain; no domain sale. |
| `/includes/cmsCollections` | `["catalog","blog","announcements"]` | Only the three approved optional content collections. |
| `/includes/excludes` | `["custom-backend","end-user-auth","checkout","research","ocr","image-editing","custom-script","custom-style","raw-html","arbitrary-component","uploaded-svg"]` | Work stays within deterministic templates and prepared client materials. |
| `/firstVersion/contractVersion` | `"2.0"` | Separate wire-contract version from policy semver. |
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
| `/firstVersion/images/formats` | `["webp"]` | Matches supplied reference raster assets; uploaded SVG excluded. |
| `/firstVersion/images/maxAssets` | `50` | Headroom over 28 reference image/brand files. |
| `/firstVersion/images/maxBytes` | `2097152` | Headroom over the 88,270-byte reference maximum. |
| `/firstVersion/images/maxTotalBytes` | `26214400` | Bounds the whole supplied bundle. |
| `/firstVersion/images/maxWidth` | `2560` | Headroom over reference width 1600. |
| `/firstVersion/images/maxHeight` | `2560` | Headroom over reference height 1900. |
| `/firstVersion/images/animated` | `false` | Static templates only. |
| `/firstVersion/images/altRequired` | `true` | Every image needs descriptive accessible copy. |
| `/firstVersion/images/hash` | `"sha256"` | Binds each declaration to actual supplied bytes. |
| `/firstVersion/approval/required` | `true` | A verified owner or enabled site administrator must approve the immutable server snapshot through the browser. |
| `/firstVersion/approval/digest` | `"sha256-sorted-json"` | Hashes the entire canonical spec; the immutable browser approval separately binds revision, actor, time and exact output hash. |
| `/firstVersion/approval/previewRequired` | `true` | The server-produced verified snapshot and required screenshots must be reviewable before browser approval. |
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
  "contractVersion": "2.0",
  "planId": "web-simple",
  "policyVersion": "2.0.0",
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
      "format": "webp",
      "bytes": 60,
      "width": 1,
      "height": 1,
      "alt": "Fictional demonstration pixel",
      "sha256": "9a776b277b4967fcc500db02122799ef3832f2c6448026b19ca6a632256d7f25"
    }
  ],
  "cms": {
    "collections": [
      "catalog",
      "blog",
      "announcements"
    ]
  }
}
```

Change request:

```json
{
  "available": false,
  "reason": "change_requests_unavailable"
}
```
