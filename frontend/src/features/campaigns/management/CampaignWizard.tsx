import type { CampaignManagementModel } from "./hooks/useCampaignManagement";
import { CampaignStepIndicator } from "./components/CampaignStepper";
import CampaignBasicsStep from "./steps/CampaignBasicsStep";
import CampaignFundingStep from "./steps/CampaignFundingStep";
import CampaignVolunteersStep from "./steps/CampaignVolunteersStep";
import CampaignImagesStep from "./steps/CampaignImagesStep";
import CampaignScheduleStep from "./steps/CampaignScheduleStep";
import CampaignActivitiesStep from "./steps/CampaignActivitiesStep";
import CampaignLocationsStep from "./steps/CampaignLocationsStep";
import CampaignConfirmationStep from "./steps/CampaignConfirmationStep";

export default function CampaignWizard({ model }: { model: CampaignManagementModel }) {
  return (
    <>
      <CampaignStepIndicator step={model.step} />
      <CampaignBasicsStep
        endDate={model.endDate}
        province={model.province}
        provinceError={model.provinceError}
        provinces={model.provinces}
        selected={model.selected}
        setEndDate={model.setEndDate}
        setProvince={model.setProvince}
        setSchedules={model.setSchedules}
        setStartDate={model.setStartDate}
        setStep={model.setStep}
        startDate={model.startDate}
        step={model.step}
      />
      <CampaignFundingStep
        bankSearch={model.bankSearch}
        bankStatus={model.bankStatus}
        banks={model.banks}
        expenses={model.expenses}
        id={model.id}
        methods={model.methods}
        otherBank={model.otherBank}
        selectedBank={model.selectedBank}
        setBankRetry={model.setBankRetry}
        setBankSearch={model.setBankSearch}
        setExpenses={model.setExpenses}
        setMethods={model.setMethods}
        setOtherBank={model.setOtherBank}
        setSelectedBank={model.setSelectedBank}
        setStep={model.setStep}
        step={model.step}
        submittedDetails={model.submittedDetails}
      />
      <CampaignVolunteersStep
        endDate={model.endDate}
        selected={model.selected}
        setStep={model.setStep}
        setVolunteerFile={model.setVolunteerFile}
        setVolunteerFileError={model.setVolunteerFileError}
        startDate={model.startDate}
        step={model.step}
        submittedDetails={model.submittedDetails}
        volunteerFile={model.volunteerFile}
        volunteerFileError={model.volunteerFileError}
      />
      <CampaignImagesStep
        cover={model.cover}
        evidence={model.evidence}
        gallery={model.gallery}
        imageChecking={model.imageChecking}
        imageError={model.imageError}
        imagePreviews={model.imagePreviews}
        mediaPreviews={model.mediaPreviews}
        selected={model.selected}
        setCover={model.setCover}
        setEvidence={model.setEvidence}
        setGallery={model.setGallery}
        setImageChecking={model.setImageChecking}
        setImageError={model.setImageError}
        setStep={model.setStep}
        step={model.step}
      />
      <CampaignScheduleStep
        endDate={model.endDate}
        lastScheduleDate={model.lastScheduleDate}
        province={model.province}
        scheduleError={model.scheduleError}
        scheduleLimit={model.scheduleLimit}
        schedules={model.schedules}
        setScheduleError={model.setScheduleError}
        setSchedules={model.setSchedules}
        setStep={model.setStep}
        startDate={model.startDate}
        step={model.step}
      />
      <CampaignActivitiesStep
        province={model.province}
        scheduleError={model.scheduleError}
        schedules={model.schedules}
        setScheduleError={model.setScheduleError}
        setSchedules={model.setSchedules}
        setStep={model.setStep}
        setWardRetry={model.setWardRetry}
        step={model.step}
        wardStatus={model.wardStatus}
        wards={model.wards}
      />
      <CampaignLocationsStep
        province={model.province}
        routeStops={model.routeStops}
        setReview={model.setReview}
        setStep={model.setStep}
        step={model.step}
      />
      <CampaignConfirmationStep
        busy={model.busy}
        cover={model.cover}

        endDate={model.endDate}
        error={model.error}
        evidence={model.evidence}
        existingEvidenceFiles={model.existingEvidenceFiles}
        existingGalleryFiles={model.existingGalleryFiles}
        expenses={model.expenses}
        gallery={model.gallery}
        id={model.id}
        imageChecking={model.imageChecking}
        imagePreviews={model.imagePreviews}
        mediaPreviews={model.mediaPreviews}
        methods={model.methods}

        province={model.province}
        review={model.review}
        routeStops={model.routeStops}
        schedules={model.schedules}
        selected={model.selected}
        setStep={model.setStep}

        startDate={model.startDate}
        step={model.step}
        submitCampaign={model.submitCampaign}
        volunteerFile={model.volunteerFile}
      />
    </>
  );
}
