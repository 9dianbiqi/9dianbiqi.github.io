# Django Permissions And FastAPI Architecture Article Design

## Goal

Publish a Chinese enterprise-practice guide that explains how to extend Django's built-in authorization system into a multi-tenant RBAC design and how to combine Django with FastAPI in an enterprise AI platform.

The article should help readers make sound architecture decisions and provide enough connected code skeletons to begin an implementation. It is not a Django installation tutorial and does not promise a complete runnable sample repository.

## Audience And Reader Promise

The primary reader already knows basic Python and has seen Django or FastAPI, but has not designed enterprise authorization across multiple services.

After reading, the reader should be able to:

- Distinguish authentication, functional authorization, and data scope.
- Explain what Django's built-in `User`, `Group`, `Permission`, and `ContentType` solve.
- Identify why Django's default model permissions do not automatically provide tenant or object isolation.
- Design tenant-scoped roles without attaching global roles directly to a user.
- Trace identity and authorization data from Django into FastAPI.
- Enforce both permission checks and resource ownership in FastAPI.
- Choose between Django-only, FastAPI-only, and combined deployments.

## Editorial Approach

Use a scenario-first narrative based on an enterprise AI platform. The article begins with concrete access-control questions, derives the permission model, and then derives the Django and FastAPI service boundaries.

The article combines:

- The explanatory strength of an architecture article.
- The practical value of connected code skeletons.
- Tables for comparisons and test matrices.
- Mermaid diagrams for the permission model, system architecture, and request flow.

The writing should match existing `guide` articles: direct Chinese prose, explicit cautions, restrained use of blockquotes, and code examples that support the explanation instead of dominating it.

## Title And Metadata

Article title:

> 企业级 Django 权限实战：从多租户 RBAC 到 Django + FastAPI 架构

Recommended content path:

`src/content/blog/django-multitenant-rbac-fastapi-architecture.md`

Recommended frontmatter:

```yaml
---
title: "企业级 Django 权限实战：从多租户 RBAC 到 Django + FastAPI 架构"
description: "从 Django 内置权限出发，设计多租户 RBAC、数据范围、JWT 身份传递与 FastAPI 鉴权，搭建企业 AI 平台的控制面和执行面。"
pubDate: 2026-07-29
articleLayout: guide
tags:
  - Django
  - FastAPI
  - Python
  - RBAC
  - 多租户
  - 企业架构
readingTime: "约 30 分钟"
draft: false
---
```

The final reading-time value may be adjusted after the finished article is measured.

## Article Structure

### 1. Why Login Is Not An Authorization System

Open with three enterprise questions:

1. Which tenant does the caller belong to?
2. Which action may the caller perform?
3. Which concrete records may the caller access?

Introduce the three layers:

```text
Authentication
    -> Functional authorization
    -> Data scope
```

### 2. Correct The Framework Comparison

Clarify:

- Django includes a mature user, group, model-permission, and Admin integration.
- FastAPI supplies strong API authentication and dependency-injection primitives, but not a complete built-in RBAC system.
- Flask can implement the same outcomes through extensions and custom design, but the framework itself offers fewer conventions.

Avoid claiming that FastAPI's built-in permission system is more complete than Flask's.

### 3. Django's Built-In Authorization Model

Explain:

- `User`
- `Group`
- `Permission`
- `ContentType`
- `is_staff`
- `is_superuser`
- Default `add`, `change`, `delete`, and `view` model permissions
- `has_perm()`
- View decorators
- Django REST Framework permission classes
- Django Admin integration

State the boundary explicitly: default model permissions do not automatically enforce tenant membership, object ownership, department scope, or cross-service authorization.

### 4. Extend The Model Into Multi-Tenant RBAC

Use the following conceptual model:

```text
Tenant
  -> Membership -> User
       -> MembershipRole
            -> Role
                 -> RolePermission
                      -> Django Permission
```

Rules:

- `User` is the person's global identity.
- `Membership` represents the user's relationship with one tenant.
- `Role` belongs to a tenant.
- A membership may have multiple roles.
- `RolePermission` reuses Django permissions to retain `ContentType` and Admin compatibility.
- Tenant-owned business resources always carry `tenant_id`.
- Resources that need scoped access also carry `owner_id` and `department_id`.

Data-scope values:

- `ALL`: all permitted resources in the tenant.
- `DEPARTMENT`: permitted resources in the caller's department.
- `OWN`: only resources owned or created by the caller.

The article must distinguish "may view knowledge bases" from "which knowledge bases may be viewed."

### 5. Enforce Three Authorization Gates

For every protected request:

1. Verify identity.
2. Verify the action permission in the active tenant.
3. Verify resource tenant ownership and data scope.

Show a Django/DRF deletion flow and explain why a client-supplied `tenant_id` is not trusted.

### 6. Why Add FastAPI

Derive service boundaries from workload and ownership rather than simplistic benchmark claims.

Django is the control plane for:

- Tenants and memberships
- Roles and permissions
- Admin
- Login and token issuance
- Billing and plans
- Audit queries
- Authoritative permission decisions

FastAPI is the execution plane for:

- Agent runs
- RAG retrieval
- File processing
- LLM calls
- Streaming responses
- AI workflow orchestration

### 7. Overall Architecture

Show a Mermaid architecture diagram covering:

- Web or application client
- API gateway
- Django control plane
- FastAPI execution plane
- PostgreSQL
- Redis
- Object or vector storage
- Model services

The diagram must show identity flowing from Django to FastAPI without implying that FastAPI blindly trusts arbitrary request headers.

### 8. Transfer Identity With JWT

Recommended claims:

- `sub`
- `tenant_id`
- `roles`
- `permission_version`
- `iss`
- `aud`
- `exp`
- `iat`
- `jti`

Django signs with a private key. FastAPI verifies with the public key. The services do not share a symmetric signing secret or Django's private signing key.

Do not put a large, fine-grained permission list into long-lived JWTs. Prefer:

- Short-lived access tokens.
- Identity, tenant, coarse roles, and permission version in the token.
- Cached permission expansion in FastAPI.
- Authoritative Django checks for sensitive operations.
- Version-based cache and token invalidation after role changes.

### 9. FastAPI Authorization Dependencies

Show the dependency chain:

```text
verify_token
    -> get_current_principal
    -> require_permission
    -> load_tenant_resource
```

Demonstrate an Agent execution endpoint. The code must load resources using both `tenant_id` and the resource identifier.

Emphasize that a valid JWT does not replace a tenant-aware database query.

### 10. Permission Synchronization Strategies

Compare:

1. Permission snapshots in JWT.
2. Live Django authorization calls.
3. A dedicated policy service.

Recommend a staged design:

- Begin with short-lived JWTs and cached role expansion.
- Recheck sensitive actions through Django.
- Introduce a policy service only after scale, policy complexity, or service count justifies it.

### 11. Project Layout And Connected Code Skeletons

Provide suggested Django and FastAPI directory trees and connected excerpts for:

- Tenant, membership, role, and role-permission models.
- Data-scope enum.
- Permission resolution service.
- DRF permission class.
- Tenant-safe queryset or resource loader.
- JWT issuance.
- FastAPI public-key validation.
- `Principal` structure.
- `require_permission()` dependency.
- Tenant-aware resource loading.
- Audit fields.

Code examples should be internally consistent in naming and import paths, but do not need to form a complete runnable repository.

### 12. Error Semantics

Use:

- `401` for absent, expired, or invalid identity.
- `403` for an authenticated caller lacking an action permission.
- `404` when a resource is absent or another tenant's resource must not be disclosed.
- `409` for permission-version, resource-version, or idempotency conflicts.
- `429` for tenant or user rate limits.

### 13. Security Boundaries And Common Mistakes

Cover:

- Treating hidden frontend buttons as authorization.
- Checking only role names.
- Trusting a request body's `tenant_id`.
- Using excessively long-lived access tokens.
- Sharing signing private keys.
- Omitting tenant filters in queries.
- Putting every permission in JWT.
- Allowing FastAPI unrestricted access to Django's internal tables.
- Letting superuser access bypass tenant context implicitly.

### 14. Test Matrix

Include:

| Scenario | Expected result |
|---|---|
| Same tenant with permission | Allowed |
| Same tenant without permission | `403` |
| Functional permission but wrong department | Concealed `404` for resource endpoints |
| Resource belongs to another tenant | `404` |
| Wrong JWT audience | `401` |
| Stale permission version | `401` and reauthorization |
| Superuser without an active tenant context | Denied |
| Forged request `tenant_id` | Ignored; use the verified principal |

### 15. Evolution Path And Selection Guidance

Show:

```text
Django built-in permissions
    -> Multi-tenant RBAC
    -> Django + FastAPI
    -> Short-lived JWT plus sensitive-operation rechecks
    -> Auditing, caching, and an optional policy service
```

End by explaining when to choose:

- Django only.
- FastAPI only.
- Django plus FastAPI.

## Code And Technical Accuracy Rules

- Use current stable Django, Django REST Framework, FastAPI, and JWT-library documentation when finalizing syntax.
- Prefer framework-native primitives and small custom services over introducing a policy engine into the first version.
- Do not present object-level permissions as built into Django's default backend.
- Do not imply that JWT revocation is instantaneous without a revocation or version check.
- Keep tenant context explicit in service APIs and database queries.
- Use asymmetric signing in the cross-service example.
- Label simplified code where production concerns such as key rotation, caching, and retries are intentionally omitted.

## Visuals

The article should contain three Mermaid diagrams:

1. Authentication, functional authorization, and data-scope layers.
2. Multi-tenant RBAC data relationships.
3. Django control plane and FastAPI execution plane request flow.

Use text and tables for framework comparisons and test cases. No generated raster cover image is required.

## Scope Exclusions

Do not include:

- Django installation instructions.
- A complete frontend.
- Kubernetes manifests.
- A complete model-serving implementation.
- A new standalone source-code repository.
- ABAC or policy-engine implementation details beyond a brief evolution note.
- Detailed OAuth or OIDC provider setup.

These exclusions keep the article focused on authorization and service boundaries.

## Validation

Before publication:

1. Verify version-sensitive claims against official Django, Django REST Framework, FastAPI, and JWT-library documentation.
2. Check every code block for consistent names and imports.
3. Confirm all Mermaid diagrams parse in the blog's renderer.
4. Run the repository's article verification scripts if present.
5. Run the production build.
6. Preview the rendered article on desktop and narrow mobile widths.
7. Verify links, table overflow, code-block scrolling, and table of contents.

## Publication Workflow

Publishing is a separate, isolated task:

1. Draft and validate the article in the blog repository.
2. Commit the article on a dedicated branch.
3. Push the branch and open a pull request when repository policy requires review; otherwise merge using the repository's established workflow.
4. Wait for GitHub Pages deployment.
5. Confirm the public article URL loads and the diagrams render.

The independent publishing agent must report the branch, commit, deployment result, and final public URL.

## Acceptance Criteria

- The article is an enterprise-practice guide rather than a beginner installation tutorial.
- Multi-tenant RBAC and data scope are the central authorization model.
- Django and FastAPI responsibilities are justified by service boundaries.
- JWT examples cover issuer, audience, expiry, tenant, permission version, and asymmetric verification.
- Code skeletons connect conceptually and use consistent names.
- Tenant isolation is enforced in both permission checks and resource queries.
- Security mistakes and a meaningful test matrix are included.
- The article builds and renders with the existing Astro `guide` layout.
- The final article is published to `https://9dianbiqi.github.io/` and its public URL is verified.
