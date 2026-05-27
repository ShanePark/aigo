"use client";

import Image from "next/image";
import { Check, X } from "lucide-react";

import { AppModal, AppModalActions } from "@/app/app-modal";
import { childAgeBandIdFromBirthYearMonth } from "@/app/me-profile-utils";
import { CHILD_AGE_BANDS, CHILD_GENDERS, type ChildAgeBandId, type ChildGender } from "@/lib/child-ages";

type CommonPickerProps = {
  confirmDisabled?: boolean;
  confirmLabel: string;
  description: string;
  disabled?: boolean;
  gender: ChildGender;
  onCancel: () => void;
  onConfirm: () => void;
  onGenderChange: (gender: ChildGender) => void;
  open: boolean;
  title: string;
};

type AgeBandPickerProps = CommonPickerProps & {
  ageBand: ChildAgeBandId;
  mode: "ageBand";
  onAgeBandChange: (ageBand: ChildAgeBandId) => void;
};

type BirthYearMonthPickerProps = CommonPickerProps & {
  birthYearMonth: string;
  maxBirthYearMonth: string;
  mode: "birthYearMonth";
  onBirthYearMonthChange: (birthYearMonth: string) => void;
};

type ChildProfilePickerModalProps = AgeBandPickerProps | BirthYearMonthPickerProps;

export function ChildProfilePickerModal(props: ChildProfilePickerModalProps) {
  const previewAgeBand = props.mode === "ageBand" ? props.ageBand : childAgeBandIdFromBirthYearMonth(props.birthYearMonth);

  return (
    <AppModal
      description={props.description}
      disabled={props.disabled}
      onClose={props.onCancel}
      open={props.open}
      size="wide"
      title={props.title}
    >
      <div className="child-profile-picker">
        <div className="child-profile-picker-row">
          <span className="child-profile-picker-label">성별 선택</span>
          <div className="child-profile-segmented" role="group" aria-label="아이 성별">
            {CHILD_GENDERS.map((gender) => {
              const isSelected = props.gender === gender.id;

              return (
                <button
                  aria-label={gender.label}
                  aria-pressed={isSelected}
                  className={isSelected ? "is-selected" : ""}
                  key={gender.id}
                  onClick={() => props.onGenderChange(gender.id)}
                  type="button"
                >
                  <span className="child-profile-segmented-icon">
                    <Image src={childProfileIconSrc({ ageBand: previewAgeBand, gender: gender.id })} alt="" aria-hidden="true" width={52} height={52} />
                  </span>
                  <span className="child-profile-segmented-label">{gender.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {props.mode === "ageBand" ? (
          <div className="child-profile-options" role="group" aria-label="아이 연령대">
            {CHILD_AGE_BANDS.map((band) => {
              const optionProfile = { ageBand: band.id, gender: props.gender };
              const isSelected = props.ageBand === band.id;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`child-profile-option tone-${band.tone} ${isSelected ? "is-selected" : ""}`}
                  key={band.id}
                  onClick={() => props.onAgeBandChange(band.id)}
                  type="button"
                >
                  <span className="child-profile-option-icon">
                    <Image src={childProfileIconSrc(optionProfile)} alt="" aria-hidden="true" width={88} height={88} />
                  </span>
                  <span className="child-profile-option-copy">
                    <strong>{band.label}</strong>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <label className="child-profile-month-field">
            <span className="child-profile-picker-label">생년월</span>
            <input
              max={props.maxBirthYearMonth}
              onChange={(event) => props.onBirthYearMonthChange(event.currentTarget.value)}
              required
              type="month"
              value={props.birthYearMonth}
            />
          </label>
        )}

        <AppModalActions>
          <button className="child-profile-cancel" type="button" onClick={props.onCancel}>
            <X size={15} aria-hidden="true" />
            취소
          </button>
          <button className="child-profile-confirm" type="button" onClick={props.onConfirm} disabled={props.disabled || props.confirmDisabled}>
            <Check size={15} aria-hidden="true" />
            {props.confirmLabel}
          </button>
        </AppModalActions>
      </div>
    </AppModal>
  );
}

export function childProfileIconSrc(profile: { ageBand: ChildAgeBandId; gender: ChildGender }) {
  return `/icons/child-profiles/${profile.gender}-${profile.ageBand}-avatar.webp`;
}
