# Scenario and product data

## Scenario: cooling-water booster reliability review

The fictional `North Utility Test Cell` has a three-component booster loop that
supplies a simulated cooling-water header. Operators observed that discharge
pressure remained below the test target after a planned restart. The acceptance
exercise uses P.A.T.C.H. to preserve the source set, relate it to Equipment and a
Project, retrieve current evidence, record the observation, and prepare a
human-reviewed procedure candidate.

The scenario mirrors common pump-system reliability work described by the U.S.
Department of Energy and hazardous-energy controls described by OSHA, but every
asset tag, measurement, setpoint, event, and project-specific instruction below
is synthetic.

## Accounts

Use unique email addresses you control in the development environment. Create:

| Test actor | Expected role |
| --- | --- |
| Booster Project Owner | Equipment creator and Project `OWNER` |
| Reliability Technician | Approved Equipment manager and Project `MEMBER` |
| Unrelated Technician | No access; may submit access requests only |

Do not write passwords into the repository. Record returned IDs in a private
file under `$env:TEMP` or in unsynced Postman local variables.

## Equipment records

### Equipment A - Cooling Water Booster Pump P-101

```json
{
  "name": "Cooling Water Booster Pump P-101",
  "type": "Vertical multistage centrifugal pump - synthetic test asset",
  "location": "North Utility Test Cell / Booster Skid",
  "description": "Test-only clean-water booster pump. Nominal test point 42 m3/h at 55 m head, 15 kW motor, 2950 rpm. Use current approved documents for evidence.",
  "documentsMode": "ADD_NOW"
}
```

Link these documents directly to Equipment A:

- `03_Pump_Inspection_Field_Guide.pdf`
- `DOE_Improving_Pumping_System_Performance.pdf`

### Equipment B - Booster Drive VFD-101

```json
{
  "name": "Booster Drive VFD-101",
  "type": "General-purpose variable-frequency drive - synthetic test asset",
  "location": "North Utility Test Cell / MCC Panel B",
  "description": "Test-only 400 V class, 15 kW drive controlling P-101 from a 4-20 mA pressure feedback loop. No live electrical work is authorized by this record.",
  "documentsMode": "ADD_NOW"
}
```

Link this document directly to Equipment B:

- `04_Multimodal_Control_Loop_Diagnostic.pdf`

### Equipment C - Discharge Pressure Transmitter PT-101

```json
{
  "name": "Discharge Pressure Transmitter PT-101",
  "type": "4-20 mA pressure transmitter - synthetic test asset",
  "location": "North Utility Test Cell / Discharge Header",
  "description": "Test-only transmitter with a nominal 0-10 bar range used as VFD-101 feedback.",
  "documentsMode": "SKIP_FOR_NOW"
}
```

## Project record

Create all three Equipment records first and substitute their returned IDs:

```json
{
  "name": "Cooling Water Booster Reliability Review",
  "description": "Test-only investigation of low discharge pressure in the North Utility Test Cell booster loop, covering P-101, VFD-101, PT-101, current source evidence, a maintenance observation, and a reviewed recurring inspection candidate.",
  "status": "ACTIVE",
  "includedEquipmentIds": [
    "<pumpEquipmentId>",
    "<driveEquipmentId>",
    "<transmitterEquipmentId>"
  ],
  "documentsMode": "ADD_NOW"
}
```

Link these as **direct Project documents**:

- `01_Project_Basis_and_Acceptance.pdf`
- `02_Equipment_Register_and_Data_Sheets.pdf`
- `OSHA_Control_of_Hazardous_Energy.pdf`

Upload `05_OCR_Shift_Inspection_Card.pdf` as a fourth direct Project document
only during the OCR test. Review the raster original carefully before approving.

## Controlled facts and expected current evidence

| Fact | Governing test source |
| --- | --- |
| Pressure target is 4.2 bar(g) | Project Basis, page 2 |
| Low-pressure test threshold is below 3.6 bar(g) for 20 seconds | Project Basis, page 2 |
| PT-101 provides 4-20 mA feedback to VFD-101 | Equipment Register, page 3; multimodal diagnostic, page 1 |
| Synthetic inspection interval is every 7 days | Project Basis, page 4 |
| OCR card observation code is `CW-17` | OCR card, raster page 1 |
| OCR card observed pressure is 3.1 bar(g) | OCR card, raster page 1 |
| Orange diamond is the visual anomaly marker | Multimodal diagnostic image only; deliberately absent from extractable text |

The final fact is a negative multimodal test. The current pipeline must not claim
the marker colour from vector retrieval because pixels are not embedded or
interpreted. A user may open the cited original PDF and inspect the page manually.

## Intended Project workflows

- Submit a Project maintenance log stating only the observed synthetic pressure
  and alarm code after they have been verified against the OCR original.
- Generate a Project procedure candidate only after at least one direct Project
  document is approved and active.
- Treat the candidate as draft-only. Review every step and citation. The generic
  official references do not define a machine-specific isolation procedure.
- A severe evidence gap or missing site-specific isolation evidence must prevent
  publication; that is a valid safety result, not a failed test.
