# Admin Curriculum Direction

The current `vizsgaanyag_5evfolyam_sources.yaml` registry is a bootstrap source, not the long-term admin system.

Target admin model:

1. `children`
   - child profile
   - current grade

2. `curriculum_subjects`
   - grade-scoped subjects

3. `curriculum_topics`
   - subject-scoped blocks

4. `curriculum_subblocks`
   - topic-scoped learning units

5. `curriculum_source_links`
   - reusable NKP/PDF links
   - a single source link may belong to multiple subblocks

6. `curriculum_subblock_links`
   - join table between subblocks and links
   - supports `content_hint`, `include_pattern`, `exclude_pattern`
   - this is the place to express: "same source URL, but only this part belongs to this subblock"

Why this matters:

- parent/admin can add/remove links anywhere, not just on missing items
- the same source can be mapped to multiple subblocks
- ingest can later use mapping hints to select the correct lesson/section subset
- YAML can remain import/bootstrap material, but not the primary source of truth

Recommended next implementation steps:

1. seed/import YAML into curriculum tables
2. parent admin CRUD UI for subjects/topics/subblocks/links
3. replace source override file workflow with DB-backed link management
4. teach ingest to use `content_hint` / pattern filters per subblock
5. tighten summary generation so it only uses filtered lesson content
