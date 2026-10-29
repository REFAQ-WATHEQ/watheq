# Migration plan: what stage 2 of the document library needs

This is a plan for your final approval. Nothing has been applied, no data will be deleted, and roles and the 3 admins are not affected.

## Checks already done on WATHEQ (read only)
- Document types: 10, no duplicates even when spaces and letter case are ignored.
- Tags: 0. Sub-subjects: 0. Links between documents and subjects: 0.
- So nothing in the current data conflicts with the new rules.

## Changes

### 1. Add a "description" field
- `knowledge_topics.description` and `document_types.description`: text, empty by default. Existing rows are not changed.

### 2. Stop deletions from removing anything else
Today, deleting a main subject also deletes its sub-subjects and its document links. This changes to:
- Changes to the parent link and to the subject-document link from automatic deletion to **refusing the deletion** (`ON DELETE RESTRICT`).
- A rule with a clear Arabic message: "cannot delete a subject that has sub-subjects or linked documents; hide it instead."
- The same protection for a document type in use (instead of the current automatic emptying of the field) and for a tag linked to documents.
- Result: no sub-subject or document link is ever deleted automatically. Hiding stays available for everything.

### 3. Prevent circular relationships
A rule that runs before every new subject and every **edit to an existing subject's parent**:
- Refuses to make a subject its own parent.
- Goes up the chain of parents from the new parent; if it reaches the subject being edited, it refuses with a clear message.
- Refuses a parent that doesn't exist.
- It works inside the database itself, so it applies even if someone bypasses the screens.

### 4. Same duplicate rule for types and tags
- Two indexes that don't allow repeating a type name or a tag name after removing extra spaces and ignoring English letter case, the same rule as subjects.
- The current exact-match uniqueness rule stays as it is.

### 5. Count the documents each visitor is actually allowed to see
A new function, `topic_document_counts()`:
- Runs with **the caller's own permissions** (not elevated), so the existing visibility rules apply to it in full.
- Counts only **published** documents that `can_read_content` allows for the visitor: everyone / signed in / employees / members of the assigned category or group.
- Counts unique documents per subject; a document linked to two subjects is counted in each.
- Never returns a number for content the visitor can't see, and returns nothing that identifies documents.
- Hidden subjects don't appear for visitors.
- In the admin panel, staff see the total including drafts, via a separate, clearly labelled count.

## Tables affected
| Table | Change |
|---|---|
| knowledge_topics | description field + parent deletion becomes refused + circularity rule + no change to existing duplicate rule |
| document_types | description field + normalized duplicate rule |
| tags | normalized duplicate rule |
| content_topics | refuse deleting a subject that's linked (the link is no longer deleted automatically) |
| content_tags | refuse deleting a tag that's linked |
| content_items | document type: deletion becomes refused instead of emptying the field |

No changes to: accounts, roles, admins, categories, groups, file links, usage records.

## Tests on an isolated database (before and after)
1. Adding a description and editing it.
2. Deleting a subject that has a sub-subject is refused, and the sub-subject stays.
3. Deleting a subject linked to a document is refused, and the link stays.
4. Deleting an unused subject, type or tag works.
5. Making a subject its own parent is refused.
6. Making a subject a child of its own grandchild (by editing an existing subject) is refused.
7. Two edits at the same time that would make a circle together: only one succeeds.
8. Repeating a type or tag name with different spacing or letter case is refused.
9. Counts: a visitor sees only "everyone"; a signed-in user adds "signed in"; an employee adds "employees"; a category or group member adds their own targeted content only; nobody counts drafts or archived documents.
10. A visitor, user or employee can't add or edit subjects, types or tags even by calling the database directly.
11. Re-running: library 24, automated 36, admin protection 24.
12. After applying to WATHEQ: confirm the 12 subjects, 10 types, 3 admins, all roles and account count are unchanged.

## After approval
Apply the migration, then build the stage 2 screens: subjects (tree view, search, collapse and expand), types, tags, and the subject cards on the document library page.
