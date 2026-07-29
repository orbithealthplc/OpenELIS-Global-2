import React from "react";
import {
  Checkbox,
  FormGroup,
  RadioButton,
  RadioButtonGroup,
} from "@carbon/react";
import { useIntl } from "react-intl";
import { getRegistryStages } from "../../../constants/ahriWorkflowRegistry";
import { getWorkflowTypeForLabUnitName } from "../../../constants/ahriLabUnitWorkflowMap";

const MODES = {
  DEFAULT: "DEFAULT",
  ALL: "ALL",
  ALLOWLIST: "ALLOWLIST",
};

/**
 * Admin control: Default (SRS) / All stages / Select stages for one lab unit.
 */
export default function LabUnitStageAccessEditor({
  labUnitId,
  labUnitName,
  selectedPersonaNames = [],
  value,
  onChange,
}) {
  const intl = useIntl();
  const workflowType = getWorkflowTypeForLabUnitName(labUnitName);
  const stages = getRegistryStages(workflowType) || [];
  const mode = (value && value.mode) || MODES.DEFAULT;
  const pageKeys = new Set((value && value.pageKeys) || []);

  const defaultKeys = new Set();
  for (const stage of stages) {
    const personas = stage.allowedPersonas || [];
    const hit = selectedPersonaNames.some((p) =>
      personas.some(
        (ap) =>
          String(ap).trim().toLowerCase() === String(p).trim().toLowerCase(),
      ),
    );
    if (hit && stage.pageKey) {
      defaultKeys.add(stage.pageKey);
    }
  }

  const emit = (nextMode, nextKeys) => {
    if (typeof onChange === "function") {
      onChange({
        mode: nextMode,
        pageKeys: Array.from(nextKeys || []),
      });
    }
  };

  if (!workflowType || stages.length === 0) {
    return (
      <p
        style={{ fontSize: "0.875rem", color: "#525252", marginTop: "0.5rem" }}
      >
        {intl.formatMessage({
          id: "systemuserrole.stageAccess.noWorkflow",
          defaultMessage:
            "No notebook workflow stages configured for this lab unit.",
        })}
      </p>
    );
  }

  return (
    <div style={{ marginTop: "0.75rem", marginBottom: "0.5rem" }}>
      <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
        {intl.formatMessage({
          id: "systemuserrole.stageAccess.title",
          defaultMessage: "Notebook stage access",
        })}
      </p>
      <RadioButtonGroup
        name={`stage-access-mode-${labUnitId}`}
        legendText={intl.formatMessage({
          id: "systemuserrole.stageAccess.modeLegend",
          defaultMessage: "Access mode",
        })}
        valueSelected={mode}
        onChange={(selected) => {
          if (selected === MODES.DEFAULT) {
            emit(MODES.DEFAULT, []);
          } else if (selected === MODES.ALL) {
            emit(MODES.ALL, []);
          } else {
            const seed =
              pageKeys.size > 0
                ? pageKeys
                : defaultKeys.size > 0
                  ? defaultKeys
                  : new Set();
            emit(MODES.ALLOWLIST, seed);
          }
        }}
      >
        <RadioButton
          id={`stage-default-${labUnitId}`}
          value={MODES.DEFAULT}
          labelText={intl.formatMessage({
            id: "systemuserrole.stageAccess.mode.default",
            defaultMessage: "Default (from user type / SRS)",
          })}
        />
        <RadioButton
          id={`stage-all-${labUnitId}`}
          value={MODES.ALL}
          labelText={intl.formatMessage({
            id: "systemuserrole.stageAccess.mode.all",
            defaultMessage: "All stages",
          })}
        />
        <RadioButton
          id={`stage-select-${labUnitId}`}
          value={MODES.ALLOWLIST}
          labelText={intl.formatMessage({
            id: "systemuserrole.stageAccess.mode.select",
            defaultMessage: "Select stages…",
          })}
        />
      </RadioButtonGroup>

      {mode === MODES.DEFAULT && (
        <p
          style={{
            fontSize: "0.8125rem",
            color: "#525252",
            marginTop: "0.5rem",
          }}
        >
          {intl.formatMessage(
            {
              id: "systemuserrole.stageAccess.defaultHint",
              defaultMessage:
                "Default stages for selected user type(s): {count} of {total}",
            },
            { count: defaultKeys.size, total: stages.length },
          )}
        </p>
      )}

      {(mode === MODES.ALLOWLIST || mode === MODES.DEFAULT) && (
        <FormGroup
          legendText={intl.formatMessage({
            id: "systemuserrole.stageAccess.stagesLegend",
            defaultMessage: "Stages",
          })}
          style={{ marginTop: "0.75rem" }}
        >
          {stages.map((stage) => {
            const key = stage.pageKey || stage.stageId;
            const checked =
              mode === MODES.DEFAULT ? defaultKeys.has(key) : pageKeys.has(key);
            const disabled = mode === MODES.DEFAULT;
            return (
              <Checkbox
                key={`${labUnitId}-${key}`}
                id={`stage-cb-${labUnitId}-${key}`}
                labelText={`${stage.stageOrder}. ${stage.stageTitle || key}`}
                checked={checked}
                disabled={disabled}
                onChange={(_e, { checked: isChecked } = {}) => {
                  if (mode !== MODES.ALLOWLIST) return;
                  const next = new Set(pageKeys);
                  if (isChecked) {
                    next.add(key);
                  } else {
                    next.delete(key);
                  }
                  emit(MODES.ALLOWLIST, next);
                }}
              />
            );
          })}
        </FormGroup>
      )}
    </div>
  );
}

export { MODES as STAGE_ACCESS_MODES };
