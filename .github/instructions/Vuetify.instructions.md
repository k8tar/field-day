## Project Structure
- The UI for Defender 3.0.0 (RELENG_2_7_2 and branches based on RELENG_2_7_2) is located in freebsd-ports/sysutils/pfSense-pkg-UI and the API is located at freebsd-ports/sysutils/pfSense-pkg-API. The UI is built using Vuetify
- The UI and API are built using Vue 3 and TypeScript
- For Defender 2.5.2 and 2.3.4 (RELENG_2_5_2 and RELENG_2_3_4), the UI is pfSense based and located in the ics-defender/src/usr/local/www/
 
## Formatting
- Prettier: no semicolons, single quotes, 140 char width, 2-space indent, trailing comma none, LF line endings 
 
## Reactivity & State
- Prefer avoiding watch statements unless it makes the code clearer or simpler. Use computed properties or handler functions (`@update:model-value`, `@change`) instead of watch when reacting to user input
- watch is acceptable in composables (e.g., useDirtyForm), for reacting to external state (router, Vuetify theme), or for dialog reset logic
- Use `ref` for simple values, `reactive` for grouped state objects with an explicit interface (e.g., `reactive<State>({ busy: false, saving: false })`)
- Prefer `computed` over `watch` for derived values
- Avoid writable computed — use read-only computed + explicit handler functions
- Use `shallowRef` for complex objects that don't need deep reactivity (e.g., API response objects, external library state)
 
## TypeScript

See `typescript.instructions.md` for all TypeScript strict typing rules. Key points:
- Never use `any`, `unknown`, `Record<string, any>`, or `ApiData` — define explicit interfaces for every entity, API response, and collection ref
- Every `ref<T>` must have an explicit generic type
- Always provide type parameters to `apiGet`/`apiPost` calls
- Use explicit null checks (`== null` / `!= null`) instead of `!!` / `!`
 
## Component Structure (script setup ordering)
1. Imports — ordered: vue core → type-only → third-party → internal utilities/constants → composables/stores → components → models/types
2. Type/interface definitions (local `State` interfaces, view models, etc.)
3. Props (`defineProps` with options object syntax) and emits (`defineEmits` with generic type syntax)
4. Composable calls — stores not destructured (`const authStore = useAuthStore()`), non-store composables destructured (`const { api } = useApi()`)
5. Template refs (`ref<InstanceType<typeof Component>>()`, `ref<HTMLElement>()`)
6. Reactive state — grouped `reactive<State>({ ... })` for view state, individual `ref`/`shallowRef` for simple values
7. Non-reactive constants and lookups (column definitions, validation rules, option arrays)
8. Computed properties (always typed: `computed<boolean>(() => ...)`)
9. Private/helper functions first, then event handlers prefixed with `handle` (`handleClickSave`, `handleUpdateFilter`, `handleToggleMode`, etc.) — every template event binding must reference a named handler function, never an inline arrow
10. Watches (sparingly — for dialog reset, prop syncing, routing changes)
11. Lifecycle hooks in order: `onBeforeMount` → `onMounted` → `onBeforeUnmount`
12. `defineExpose` (last, only if needed)
 
## API & Loading State
- Use `apiGet`/`apiPost` from `@/composables/useApi`
- Track loading state in the consuming component (`ref<boolean>` or grouped `reactive<State>` with `busy`, `saving`, etc.), not in the store/composable
- Use try/catch/finally pattern: set loading true before, false in finally
- Use `useNotificationStore()` for success/error feedback
- Prefer built-in browser APIs (`XMLSerializer`, `DOMParser`, `URL`, `Intl`, etc.) over hand-rolled string-based equivalents
- For API responses with stable, known structure: access properties directly without defensive fallback chains. We manage the API — use `data.data?.property ?? []` not `(data.data?.property ?? data.property) ?? (data.data?.rows ?? data.rows)`
 
## Composables & Stores
- Do not use Pinia. Use plain composable functions with module-level state 
- Store files live under `@/stores/` and export a `useXxxStore()` function
- Hoist reactive state (`ref`, `computed`) to module scope so it's shared across all callers
- Functions that mutate state go inside the composable function body
- Composables should return a typed interface
- Extract reusable logic into composables under `@/composables/`
- Prefer composables over inline complex logic in components
- In stores, use a single `reactive` object for state and return functions separately — do not wrap individual `ref`s in a `reactive` object or put functions in the reactive object
- Name the data-loading function `fetch` (not `loadXxx`)
- Use a module-level `_fetched` flag to skip redundant requests; expose an `invalidate()` function for the rare cases that need a forced refetch instead of a `force` parameter
- Stores/composables that cache shared data should call `onMounted(fetch)` inside the composable function so consumers get auto-populated data without explicit fetch calls. Vue lifecycle hooks (`onMounted`, `onUnmounted`, etc.) work in `.ts` composable files, not only in `.vue` components — use them to keep consumer code minimal

### Store file ordering
1. Imports
2. Type/interface definitions (internal `State`, exported interfaces)
3. Module-level reactive state (hoisted outside the function)
4. Module-level constants/variables
5. Exported composable function (`useXxxStore`)
   - Composable calls (useApi, etc.)
   - Computed properties
   - Functions (fetch, create, remove, etc.)
   - Return statement: `{ state, computedProps, ...functions }` (state is the reactive object, functions are separate)

### Composable file ordering
1. Imports
2. Exported types/interfaces
3. Module-level reactive state (outside function)
4. Module-level constants
5. Exported composable function (`useXxx`)
   - Computed properties derived from state
   - Functions
   - Return statement

### Utility file ordering
1. Imports
2. Exported types/interfaces
3. Module-level constants (regex patterns, lookup tables)
4. Exported functions (pure, stateless)
 
## Template Patterns
- Use `v-model` for two-way binding, `@update:model-value` for side-effect handling
- Use Vuetify's `#activator="{ props }"` pattern with `v-bind="props"` for tooltips, menus, dialogs
- Prefer event handlers over watches for responding to user interactions
- Never use inline arrow functions in event handlers in templates — always extract to a named handler function in the `<script>` block
- In `v-for` loops, use the loop variable directly in bindings (e.g., `v-model="item"`) instead of re-indexing (e.g., `v-model="array[idx]"`). Don't prefix unused loop variables with `_` if they can be used directly
- Prefer `provide`/`inject` over `defineExpose` + template refs for parent-child communication (e.g., triggering refresh from a parent)
- For `v-switch` and other nullable Vuetify model emitters, type handlers to accept nullable values (e.g., `boolean | null`) and normalize explicitly in the handler
- For `DataTable` multi-select with `item-key`, keep the selection model typed as key values (usually `string[]` uniqids). If object data is needed, map selected keys back to the source collection first
- When a backend field is stored as a serialized string (for example, space-delimited rule uniqids), parse/serialize with dedicated helpers and do not treat it as an array in component logic
 
## CRUD Views with FormDialog
- Use `reactive<T>({...})` (not `ref<T>`) for the form model. Reset it with direct property assignment in `openCreate` and `openEdit` (do not use `Object.assign`).
- Name CRUD entry points `openCreate()` and `openEdit(item)`. Name the delete handler `delete<Entity>(item)` (e.g. `deleteVip`). Do not prefix these with `handle`.
- The `@update:item` FormDialog callback must be named `handleItemUpdate`. Copy fields from `item` into `model` with direct assignments, then call `save()`.
- `save()` reads directly from `model` (the reactive object), not from the FormDialog-emitted item. `handleItemUpdate` copies the item into `model` first, then calls `save()`.
- Track the edit key with `const editId = ref('')`, assigned inside `openEdit`.
- `load()` must use `try/catch/finally` with `loading.value = true` in setup and `loading.value = false` in `finally`.