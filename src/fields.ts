import type { Kind, Settings } from "./model";
export type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
};
const f = (
  key: string,
  label: string,
  type = "text",
  required = false,
): Field => ({ key, label, type, required });
const select = (
  key: string,
  label: string,
  options: string[],
  required = false,
): Field => ({ key, label, type: "select", options, required });
export function fields(kind: Kind, s: Settings): Field[] {
  switch (kind) {
    case "candidates":
      return [
        f("firstName", "First name", "text", true),
        f("lastName", "Last name", "text", true),
        f("email", "Email", "email"),
        f("phone", "Phone"),
        f("title", "Current job title"),
        f("employer", "Current employer"),
        f("city", "City"),
        f("state", "State / region"),
        f("country", "Country"),
        f("experience", "Years of experience", "number"),
        f("linkedin", "LinkedIn profile", "url"),
        f("website", "Portfolio / website", "url"),
        f("skills", "Primary skills"),
        f("additionalSkills", "Additional skills"),
        f("education", "Education"),
        f("certifications", "Certifications"),
        select("source", "Source", s.sources),
        select("owner", "Recruiter / owner", s.recruiters),
        f("applicationDate", "Application date", "date"),
        select("status", "Candidate status", s.stages),
        f("currentCompensation", "Current compensation (optional)"),
        f("desiredCompensation", "Desired compensation (optional)"),
        f("authorization", "Work authorization (optional)"),
        select("relocation", "Relocation", ["Yes", "No", "Open to discussion"]),
        select("workPreference", "Work preference", [
          "Remote",
          "Hybrid",
          "Onsite",
        ]),
        f("availability", "Availability / notice period"),
        f("tags", "Tags (comma separated)"),
        f("notes", "Profile notes", "textarea"),
        ...s.customFields.map((k) => f("custom_" + k, k)),
      ];
    case "jobs":
      return [
        f("title", "Job title", "text", true),
        f("requisitionId", "Requisition reference"),
        f("department", "Department"),
        f("hiringManager", "Hiring manager"),
        select("owner", "Recruiter", s.recruiters),
        select("employmentType", "Employment type", [
          "Full-time",
          "Part-time",
          "Contract",
          "Temporary",
          "Internship",
        ]),
        f("location", "Work location"),
        select("workPreference", "Work classification", [
          "Remote",
          "Hybrid",
          "Onsite",
        ]),
        f("description", "Job description", "textarea"),
        f("skills", "Required skills"),
        f("qualifications", "Preferred qualifications", "textarea"),
        f("openings", "Number of openings", "number"),
        f("compensation", "Compensation range"),
        f("opened", "Date opened", "date"),
        f("targetClose", "Target close date", "date"),
        select("status", "Requisition status", s.jobStatuses),
        f("notes", "Notes", "textarea"),
      ];
    case "applications":
      return [
        f("candidateId", "Candidate", "candidate", true),
        f("jobId", "Requisition", "job", true),
        select("stage", "Stage", s.stages, true),
        f("appliedAt", "Application date", "date"),
        f("rejectionReason", "Rejection reason"),
        f("notes", "Application notes", "textarea"),
      ];
    case "interviews":
      return [
        f("candidateId", "Candidate", "candidate", true),
        f("jobId", "Requisition", "job"),
        select("type", "Interview type", [
          "Recruiter Screen",
          "Phone",
          "Video",
          "Onsite",
          "Technical",
          "Final",
        ]),
        f("date", "Local date and time", "datetime-local", true),
        f("timezone", "IANA time zone", "text", true),
        f("interviewers", "Interviewers"),
        f("location", "Location"),
        f("meetingLink", "Meeting link", "url"),
        select("status", "Interview status", [
          "Scheduled",
          "Completed",
          "Rescheduled",
          "Cancelled",
          "No Show",
        ]),
        f("feedback", "Interview feedback", "textarea"),
        select("decision", "Decision", [
          "Pending",
          "Advance",
          "Hold",
          "Reject",
        ]),
        f("nextSteps", "Next steps", "textarea"),
      ];
    case "activities":
      return [
        f("candidateId", "Candidate", "candidate", true),
        f("jobId", "Requisition", "job"),
        select("type", "Activity type", [
          "Email",
          "Phone Call",
          "LinkedIn Message",
          "Text Message",
          "Interview",
          "Follow-Up",
          "General Note",
        ]),
        f("date", "Activity date and time", "datetime-local"),
        f("subject", "Subject", "text", true),
        f("notes", "Notes", "textarea"),
        f("nextAction", "Next action"),
        f("due", "Follow-up due (your device time)", "datetime-local"),
        select("owner", "Recruiter", s.recruiters),
        f("completed", "Completed", "checkbox"),
      ];
    case "templates":
      return [
        f("title", "Template name", "text", true),
        select("type", "Channel", ["Email", "LinkedIn Message"]),
        f("subject", "Subject"),
        f("body", "Message body", "textarea"),
      ];
    default:
      return [];
  }
}
