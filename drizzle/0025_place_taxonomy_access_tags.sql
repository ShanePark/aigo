alter table places
  alter column taxonomy set default
  '{"schemaVersion":1,"sourceBacked":{"familyFitGates":[],"activityTypes":[],"visitUseCases":[],"ageBands":[],"accessTags":[],"logisticsTags":[],"riskTags":[]},"inferred":{"familyFitGates":[],"activityTypes":[],"visitUseCases":[],"ageBands":[],"accessTags":[],"logisticsTags":[],"riskTags":[]},"migration":{"legacyTags":[],"broadMappedTags":[],"unmappedTags":[]}}'::jsonb;

update places
set taxonomy = jsonb_set(
    jsonb_set(
      taxonomy,
      '{sourceBacked,accessTags}',
      coalesce(taxonomy #> '{sourceBacked,accessTags}', '[]'::jsonb),
      true
    ),
    '{inferred,accessTags}',
    coalesce(taxonomy #> '{inferred,accessTags}', '[]'::jsonb),
    true
  )
where taxonomy #> '{sourceBacked,accessTags}' is null
   or taxonomy #> '{inferred,accessTags}' is null;
