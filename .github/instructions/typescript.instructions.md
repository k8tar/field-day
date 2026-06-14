---
applyTo: "**/*.ts,**/*.vue"
---

## TypeScript — Strict Typing Rules

### No `any`, `unknown`, or `Record<string, any>`

- **Never use `any`, `unknown`, or `Record<string, any>` (including `ApiData`) for component-local data, function parameters, return types, or API response shapes.** These types bypass type safety and hide bugs.
  - BAD: `const payload: Record<string, any> = { ...model }`
  - BAD: `const profiles = ref<ApiData[]>([])`
  - GOOD: Define a typed interface: `interface IndproProfile { id?: number; name: string; ... }` then `ref<IndproProfile[]>([])`
- For function parameters and return types, always use specific types — never `unknown` or `any`.
- Use discriminated unions and literal types instead of generic records where possible.

### Always define interfaces for API shapes

- Every API response must have a corresponding named interface that matches the API contract.
- Always provide type parameters to `apiGet`/`apiPost` calls: `apiGet<MyResponse>(...)`. Do not call them without a generic.
- Do not use `ApiData` (`Record<string, any>`) for any API response collection — define a typed interface for each entity.
- Collection refs must use a named interface: `ref<IndproProfile[]>([])` not `ref<object[]>([])` or `ref<any[]>([])`.

### API model file location and naming (required)

- API request/response interfaces must not live inside service files.
- Place API interfaces under `src/models/api/`.
- Use one file per API domain/resource group, named after the endpoint group (for example `users.ts`, `orders.ts`, `auth.ts`).
- Shared generic API envelope types (for example `ApiResponse<T>`) belong in `src/models/api/common.ts`.
- Service files should import these interfaces from `src/models/api/*` and only contain transport/client logic.

### Strictly type all `ref` declarations

- Every `ref<T>` must have an explicit generic type — do not rely solely on type inference when the ref holds API data, nullable values, or union types.
  - GOOD: `ref<number | null>(null)`, `ref<IndproProfile[]>([])`, `ref<TestResult | null>(null)`
  - BAD: `ref(null)` when the ref will later hold a typed value
- Use `ref<number | null>(null)` for edit IDs that start unset and are populated when editing an existing item. `null` is the correct sentinel (not `0` or `undefined`) because it explicitly represents "not currently editing".
- Use `ref<T | null>(null)` for nullable results — not `ref<T>({})` with a fake empty object.

### No `as` type assertions for runtime values

- Never use `as` to cast a runtime value to a different type. Instead:
  - Use `Number(value)` with `Number.isNaN()` check instead of `value as number`
  - Use `String(value)` instead of `value as string`
  - Use typed `.map<T>()` generics instead of `as T[]` on the result
- Type assertions (`as`) are only acceptable for narrowing within a controlled type guard, not to silence TypeScript errors on runtime data.

### Null checks

- Use explicit null checks (`== null` / `!= null`) instead of `!!` / `!` for checking whether a value is present. This applies everywhere — not only when a value could be `0` or `''`.

### Typed catch blocks

- Use typed `catch` blocks:
  ```ts
  catch (e: unknown) {
    const err = e as Error & { response?: { data?: { errors?: string[] } }; code?: string }
    ...
  }
  ```
  Never use `catch (err: any)`.

### Vue-specific typing

- Type template slot bindings with proper interfaces — never `{ item: any }`.
- Use options object syntax for `defineProps` (with `PropType<T>` for complex types) and generic type syntax for `defineEmits`.
- Computed properties must always declare their return type: `computed<boolean>(() => ...)`.
- Do not create unnecessary import aliases. Import functions directly by their original name and call them with the correct arguments — do not alias and re-wrap.
- **Do not wrap store values or computed properties in a computed wrapper without transformation.** If a computed just returns `storeValue.value` or passes through data unchanged, use the reference directly. Computing-for-free adds no value and obscures the data source.
  - BAD: `const options = computed(() => store.options.value)` then use `options.value` in template
  - GOOD: Use `store.options.value` directly in template, or store as `const options = store.options` then use `options.value`
- **Avoid `Object.assign()` when direct property assignment is clearer.** For reactive objects in setup, directly assign properties instead of using Object.assign:
  - BAD: `Object.assign(model, { name: '', value: 0 })`
  - GOOD: `model.name = ''; model.value = 0`
  - Exception: `Object.assign()` is acceptable when merging multiple objects from different sources or spreading computed/dynamic objects.

### Interfaces for component state

- Define a typed interface for each distinct shape of data used in the component:
  - API response entities (e.g., `IndproProfile`, `IndproRule`)
  - Form models (e.g., the shape returned by `emptyRule()`)
  - Result/status objects (e.g., `BulkDeleteResult`, `TestResult`)
  - Column/display option arrays (e.g., `IndproComboOption = { title: string; value: string }`)
- When a function accepts items from an API collection, type the parameter with the entity interface — not `ApiData` or an inline object type.

### PR feedback patterns to enforce

- Do not coerce already-typed string fields with `String(...)` or fallback them with `?? ''` when the interface guarantees a string. Use the typed property directly.
- If callers repeatedly use `?? ''` only to satisfy a function signature, widen the function parameter type (for example `string | undefined`) and handle nullish input inside the function.
- For edit IDs, do not use mixed `string | number` sentinel patterns. Use `ref<number | null>(null)` and keep IDs numeric throughout CRUD flows.
- Prefer user-defined type guards over inline assertions when narrowing union items in arrays (for example display-item unions). Avoid `(item as SomeType)` in filtering and lookup logic.
- When transformation logic repeats across multiple fields (for example hex encode/decode), extract typed helper functions instead of duplicating conversion expressions inline.
