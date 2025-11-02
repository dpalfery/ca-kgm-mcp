name: "Folder-Rule"
description: "Enforces fundamental Clean Architecture principles and layered structure that apply across all development activities in Hotshot Logistics."
when-to-apply:
"Apply when creating, moving, adding, or searching files to maintain separation of concerns and dependency direction across all technology stacks."
rule: |

# Clean Architecture + DDD Folder Structure (C#)

## **1-Presentation Layer**

**Purpose:** Entry point for all user interactions (HTTP, gRPC, SignalR, etc.)

**Projects:** `HotshotLogistics.Api`, `HotshotLogistics.UI`, or `HotshotLogistics.Web`

**Contents:**

* **Controllers / Endpoints:** ASP.NET Core API controllers or minimal APIs
  *Folder:* `Controllers`
* **Hubs:** SignalR hubs for real-time updates
  *Folder:* `Hubs`
* **Filters / Middleware:** Exception handling, logging, request validation
  *Folder:* `Middleware`
* **ViewModels / DTOs:** Request/response payloads specific to presentation
  *Folder:* `DTOs`
* **Static Content / Pages:** Razor pages or SPA static assets
  *Folder:* `wwwroot` or `Pages`
* **Program.cs / Startup.cs:** Composition root, DI setup, and pipeline config

> This layer calls into `2-Application` only. It does not directly reference persistence or domain implementations.

---

## **2-Application Layer**

**Purpose:** Orchestrates use cases and enforces application logic, coordinating between domain and infrastructure.

**Project:** `HotshotLogistics.Application`

**Contents:**

* **Services / Use Cases:** Application service classes implementing workflows
  *Folder:* `Services`
* **Commands / Queries / Handlers:** CQRS pattern logic, mediator handlers
  *Folder:* `Features` or `Handlers`
* **Validators:** Input validation (FluentValidation, custom logic)
  *Folder:* `Validators`
* **Authorization:** Policy providers, role/claim checks
  *Folder:* `Authorization`
* **DTOs:** Input/output models for use cases
  *Folder:* `DTOs`
* **Events / Notifications:** Application-level events or mediators
  *Folder:* `Events`
* **Dependency Injection Extensions:**
  *File:* `ServiceCollectionExtensions.cs`

> This layer depends only on `3-Domain` and `4-Contracts`.
> Contains no UI or infrastructure logic.

---

## **3-Domain Layer**

**Purpose:** Pure business logic, rules, and core models.

**Projects:**

* `HotshotLogistics.Domain` → concrete domain models and logic
* `HotshotLogistics.Contracts` → shared interfaces and abstractions

**Contents:**

* **Entities:** Aggregate roots and domain entities
  *Folder:* `Entities`
  *Example:* `Order.cs`, `Job.cs`
* **ValueObjects:** Immutable types without identity
  *Folder:* `ValueObjects`
* **Domain Services:** Business rules not tied to entities
  *Folder:* `Services`
* **Factories:** Construction logic enforcing invariants
  *Folder:* `Factories` (in `Contracts` if shared)
* **Repositories / Interfaces:** Domain contracts for persistence and messaging
  *Folder:* `Repositories`, `Hubs`, etc. (in `Contracts`)
* **Domain Events:** Core events representing state changes
  *Folder:* `Events`
* **DTOs (Domain-Scoped):** Internal payloads used inside domain boundaries
  *Folder:* `DTOs`
* **Dependencies:** Shared abstractions for dependency registration
* **README.md:** Explain model boundaries and design rules

> The domain is completely persistence-agnostic and unaware of infrastructure.

---

## **4-Persistence Layer**

**Purpose:** Implements data storage and retrieval using EF Core, Dapper, or external stores.

**Project:** `HotshotLogistics.Persistence`

**Contents:**

* **DbContext:** EF Core database context
  *Folder:* `Contexts`
* **Entity Configurations:** Mapping, relationships, and constraints
  *Folder:* `Configurations`
* **Repositories:** Implementation of domain repository interfaces
  *Folder:* `Repositories`
* **Migrations / Seed Data:** Database migrations and seeders
  *Folder:* `Migrations`, `Seed`
* **ReadModels / Projections:** Optimized models for queries
  *Folder:* `ReadModels`
* **README.md:** Connection strings, migration usage, conventions

> References `3-Domain` and `4-Contracts`, but never `1-Presentation`.

---

## **5-Test **

**Purpose:** unit and integration tests.

**Contents:**

- Unit tests, integration tests, architecture tests
- Test utilities, fixtures, mock data
- Test configurations and helpers
- Uses xUnit, FluentAssertions

---

## **6-Docs**

**Purpose:** Internal documentation, architectural decisions, and tasks.

* `architecture-general.md`
* `interface-cleanup-tasks.md`
* Diagrams, design notes, checklists



