import { describe, expect, it, vi, test, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { selectOrganization } from "test-utils";
import { organizationService } from "#/api/organization-service/organization-service.api";
import ManageOrganizationMembers from "#/routes/manage-organization-members";
import SettingsScreen, {
  clientLoader as settingsClientLoader,
} from "#/routes/settings";
import {
  ORGS_AND_MEMBERS,
  resetOrgMockData,
  resetOrgsAndMembersMockData,
} from "#/mocks/org-handlers";
import OptionService from "#/api/option-service/option-service.api";
import { useRolePermissions } from "#/hooks/use-role-permissions";
import { OrganizationUserRole } from "#/types/org";

// Mock the role permissions hook
vi.mock("#/hooks/use-role-permissions", () => ({
  useRolePermissions: vi.fn(),
}));

function ManageOrganizationMembersWithPortalRoot() {
  return (
    <div>
      <ManageOrganizationMembers />
      <div data-testid="portal-root" id="portal-root" />
    </div>
  );
}

const RouteStub = createRoutesStub([
  {
    // @ts-expect-error - ignoreing error for test stub
    loader: settingsClientLoader,
    Component: SettingsScreen,
    path: "/settings",
    HydrateFallback: () => <div>Loading...</div>,
    children: [
      {
        Component: ManageOrganizationMembersWithPortalRoot,
        path: "/settings/organization-members",
      },
      {
        Component: () => <div data-testid="user-settings" />,
        path: "/settings/user",
      },
    ],
  },
]);

let queryClient: QueryClient;

describe("Manage Organization Members Route", () => {
  beforeEach(() => {
    const getConfigSpy = vi.spyOn(OptionService, "getConfig");
    // @ts-expect-error - only return APP_MODE for these tests
    getConfigSpy.mockResolvedValue({
      APP_MODE: "saas",
    });

    queryClient = new QueryClient();

    vi.mocked(useRolePermissions).mockReturnValue({
      canInviteUsers: true,
      canAddCredits: false,
      canDeleteOrganization: false,
      canChangeRoleToOwner: false,
      canChangeRoleToAdmin: false,
      canChangeRoleToUser: false,
      getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => []),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset organization mock data to ensure clean state between tests
    resetOrgMockData();
    // Reset ORGS_AND_MEMBERS to initial state
    resetOrgsAndMembersMockData();
    // Clear queryClient cache to ensure fresh data for next test
    queryClient.clear();
  });

  const renderManageOrganizationMembers = () =>
    render(<RouteStub initialEntries={["/settings/organization-members"]} />, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

  it("should render", async () => {
    renderManageOrganizationMembers();
    await screen.findByTestId("manage-organization-members-settings");
  });

  it("should navigate away from the page if not saas", async () => {
    const getConfigSpy = vi.spyOn(OptionService, "getConfig");
    // @ts-expect-error - only return APP_MODE for these tests
    getConfigSpy.mockResolvedValue({
      APP_MODE: "oss",
    });

    renderManageOrganizationMembers();
    expect(
      screen.queryByTestId("manage-organization-members-settings"),
    ).not.toBeInTheDocument();
  });

  it("should allow the user to select an organization", async () => {
    const getOrganizationMembersSpy = vi.spyOn(
      organizationService,
      "getOrganizationMembers",
    );

    renderManageOrganizationMembers();
    await screen.findByTestId("manage-organization-members-settings");

    expect(getOrganizationMembersSpy).not.toHaveBeenCalled();

    await selectOrganization({ orgIndex: 0 });
    expect(getOrganizationMembersSpy).toHaveBeenCalledExactlyOnceWith({
      orgId: "1",
    });
  });

  it("should render the list of organization members", async () => {
    renderManageOrganizationMembers();
    await screen.findByTestId("manage-organization-members-settings");

    await selectOrganization({ orgIndex: 0 });
    const members = ORGS_AND_MEMBERS["1"];

    const memberListItems = await screen.findAllByTestId("member-item");
    expect(memberListItems).toHaveLength(members.length);

    members.forEach((member) => {
      expect(screen.getByText(member.email)).toBeInTheDocument();
      expect(screen.getByText(member.role)).toBeInTheDocument();
    });
  });

  test("an admin should be able to change the role of a organization member", async () => {
    vi.mocked(useRolePermissions).mockReturnValue({
      canInviteUsers: true,
      canAddCredits: false,
      canDeleteOrganization: false,
      canChangeRoleToOwner: false,
      canChangeRoleToAdmin: true,
      canChangeRoleToUser: true,
      getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
        "admin",
        "user",
      ]),
    });

    const updateMemberRoleSpy = vi.spyOn(
      organizationService,
      "updateMemberRole",
    );

    renderManageOrganizationMembers();
    await screen.findByTestId("manage-organization-members-settings");

    await selectOrganization({ orgIndex: 0 });

    const memberListItems = await screen.findAllByTestId("member-item");
    const userRoleMember = memberListItems[2]; // third member is "user"

    let userCombobox = within(userRoleMember).getByText(/user/i);
    expect(userCombobox).toBeInTheDocument();
    await userEvent.click(userCombobox);

    const dropdown = within(userRoleMember).getByTestId("role-dropdown");
    const adminOption = within(dropdown).getByText(/admin/i);
    expect(adminOption).toBeInTheDocument();
    await userEvent.click(adminOption);

    expect(updateMemberRoleSpy).toHaveBeenCalledExactlyOnceWith({
      userId: "3", // assuming the third member is the one being updated
      orgId: "1",
      role: "admin",
    });
    expect(
      within(userRoleMember).queryByTestId("role-dropdown"),
    ).not.toBeInTheDocument();

    // Verify the role has been updated in the UI
    userCombobox = within(userRoleMember).getByText(/admin/i);
    expect(userCombobox).toBeInTheDocument();

    // revert the role back to user
    await userEvent.click(userCombobox);
    const userOption = within(
      within(userRoleMember).getByTestId("role-dropdown"),
    ).getByText(/user/i);
    expect(userOption).toBeInTheDocument();
    await userEvent.click(userOption);

    expect(updateMemberRoleSpy).toHaveBeenNthCalledWith(2, {
      userId: "3",
      orgId: "1",
      role: "user",
    });

    // Verify the role has been reverted in the UI
    userCombobox = within(userRoleMember).getByText(/user/i);
    expect(userCombobox).toBeInTheDocument();
  });

  it("should not allow a user to invite a new organization member", async () => {
    vi.mocked(useRolePermissions).mockReturnValue({
      canInviteUsers: false,
      canAddCredits: false,
      canDeleteOrganization: false,
      canChangeRoleToOwner: false,
      canChangeRoleToAdmin: false,
      canChangeRoleToUser: false,
      getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => []),
    });

    renderManageOrganizationMembers();
    await screen.findByTestId("manage-organization-members-settings");

    const inviteButton = screen.queryByRole("button", {
      name: /ORG\$INVITE_ORGANIZATION_MEMBER/i,
    });
    expect(inviteButton).not.toBeInTheDocument();
  });

  it("should not allow an admin to change the owner's role", async () => {
    vi.mocked(useRolePermissions).mockReturnValue({
      canInviteUsers: true,
      canAddCredits: false,
      canDeleteOrganization: false,
      canChangeRoleToOwner: false,
      canChangeRoleToAdmin: true,
      canChangeRoleToUser: true,
      getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
        "admin",
        "user",
      ]),
    });

    renderManageOrganizationMembers();
    await screen.findByTestId("manage-organization-members-settings");

    await selectOrganization({ orgIndex: 2 }); // user is admin in org 3

    const memberListItems = await screen.findAllByTestId("member-item");
    const ownerMember = memberListItems[0]; // first member is "owner
    const userCombobox = within(ownerMember).getByText(/owner/i);
    expect(userCombobox).toBeInTheDocument();
    await userEvent.click(userCombobox);

    // Verify that the dropdown does not open for owner
    expect(
      within(ownerMember).queryByTestId("role-dropdown"),
    ).not.toBeInTheDocument();
  });

  it("should not allow an admin to change another admin's role", async () => {
    vi.mocked(useRolePermissions).mockReturnValue({
      canInviteUsers: true,
      canAddCredits: false,
      canDeleteOrganization: false,
      canChangeRoleToOwner: false,
      canChangeRoleToAdmin: true,
      canChangeRoleToUser: true,
      getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
        "admin",
        "user",
      ]),
    });

    renderManageOrganizationMembers();
    await screen.findByTestId("manage-organization-members-settings");

    await selectOrganization({ orgIndex: 2 }); // user is admin in org 3

    const memberListItems = await screen.findAllByTestId("member-item");
    const adminMember = memberListItems[1]; // first member is "admin"
    expect(adminMember).toBeDefined();

    const roleText = within(adminMember).getByText(/admin/i);
    await userEvent.click(roleText);

    // Verify that the dropdown does not open for the other admin
    expect(
      within(adminMember).queryByTestId("role-dropdown"),
    ).not.toBeInTheDocument();
  });

  it("should not allow a user to change their own role", async () => {
    // Mock the /me endpoint to return a user ID that matches one of the members
    const getMeSpy = vi.spyOn(organizationService, "getMe");
    getMeSpy.mockResolvedValue({
      id: "1", // Same as Alice from org 1
      email: "alice@acme.org",
      role: "owner",
      status: "active",
    });

    renderManageOrganizationMembers();
    await screen.findByTestId("manage-organization-members-settings");

    await selectOrganization({ orgIndex: 0 });

    const memberListItems = await screen.findAllByTestId("member-item");
    const currentUserMember = memberListItems[0]; // First member is Alice (id: "1")

    const roleText = within(currentUserMember).getByText(/owner/i);
    await userEvent.click(roleText);

    // Verify that the dropdown does not open for the current user's own role
    expect(
      within(currentUserMember).queryByTestId("role-dropdown"),
    ).not.toBeInTheDocument();
  });

  it("should show a remove option in the role dropdown and remove the user from the list", async () => {
    const removeMemberSpy = vi.spyOn(organizationService, "removeMember");

    renderManageOrganizationMembers();
    await screen.findByTestId("manage-organization-members-settings");

    await selectOrganization({ orgIndex: 0 });

    // Get initial member count
    const memberListItems = await screen.findAllByTestId("member-item");
    const initialMemberCount = memberListItems.length;

    const userRoleMember = memberListItems[2]; // third member is "user"
    const userEmail = within(userRoleMember).getByText("charlie@acme.org");
    expect(userEmail).toBeInTheDocument();

    const userCombobox = within(userRoleMember).getByText(/user/i);
    await userEvent.click(userCombobox);

    const dropdown = within(userRoleMember).getByTestId("role-dropdown");

    // Check that remove option exists
    const removeOption = within(dropdown).getByText(/remove/i);
    expect(removeOption).toBeInTheDocument();

    // Check that remove option has danger styling (red color)
    expect(removeOption).toHaveClass("text-red-500"); // or whatever danger class is used

    await userEvent.click(removeOption);

    expect(removeMemberSpy).toHaveBeenCalledExactlyOnceWith({
      orgId: "1",
      userId: "3",
    });

    // Verify the user is no longer in the list
    await waitFor(() => {
      const updatedMemberListItems = screen.getAllByTestId("member-item");
      expect(updatedMemberListItems).toHaveLength(initialMemberCount - 1);
    });

    // Verify the specific user email is no longer present
    expect(screen.queryByText("charlie@acme.org")).not.toBeInTheDocument();
  });

  it.todo(
    "should not allow a user to change another user's role if they are the same role",
  );

  describe("Inviting Organization Members", () => {
    it("should render an invite organization member button", async () => {
      renderManageOrganizationMembers();
      await selectOrganization({ orgIndex: 0 });

      const inviteButton = await screen.findByRole("button", {
        name: /ORG\$INVITE_ORGANIZATION_MEMBER/i,
      });
      expect(inviteButton).toBeInTheDocument();
    });

    it("should render a modal when the invite button is clicked", async () => {
      renderManageOrganizationMembers();
      await selectOrganization({ orgIndex: 0 });

      expect(screen.queryByTestId("invite-modal")).not.toBeInTheDocument();
      const inviteButton = await screen.findByRole("button", {
        name: /ORG\$INVITE_ORGANIZATION_MEMBER/i,
      });
      await userEvent.click(inviteButton);

      const portalRoot = screen.getByTestId("portal-root");
      expect(
        within(portalRoot).getByTestId("invite-modal"),
      ).toBeInTheDocument();
    });

    it("should close the modal when the close button is clicked", async () => {
      renderManageOrganizationMembers();

      await selectOrganization({ orgIndex: 0 });

      const inviteButton = await screen.findByRole("button", {
        name: /ORG\$INVITE_ORGANIZATION_MEMBER/i,
      });
      await userEvent.click(inviteButton);

      const modal = screen.getByTestId("invite-modal");
      const closeButton = within(modal).getByText("BUTTON$CANCEL");
      await userEvent.click(closeButton);

      expect(screen.queryByTestId("invite-modal")).not.toBeInTheDocument();
    });

    it("should render a list item in an invited state when a the user is is invited", async () => {
      const getOrganizationMembersSpy = vi.spyOn(
        organizationService,
        "getOrganizationMembers",
      );

      getOrganizationMembersSpy.mockResolvedValue([
        {
          id: "4",
          email: "tom@acme.org",
          role: "user",
          status: "invited",
        },
      ]);

      renderManageOrganizationMembers();

      await selectOrganization({ orgIndex: 0 });

      const members = await screen.findAllByTestId("member-item");
      expect(members).toHaveLength(1);

      const invitedMember = members[0];
      expect(invitedMember).toBeInTheDocument();

      // should have an "invited" badge
      const invitedBadge = within(invitedMember).getByText(/invited/i);
      expect(invitedBadge).toBeInTheDocument();

      // should not have a role combobox
      await userEvent.click(within(invitedMember).getByText(/user/i));
      expect(
        within(invitedMember).queryByTestId("role-dropdown"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Role-based invite permission behavior", () => {
    it("should show invite button when user has canInviteUsers permission (Owner role)", async () => {
      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: false,
        canDeleteOrganization: false,
        canChangeRoleToOwner: false,
        canChangeRoleToAdmin: false,
        canChangeRoleToUser: false,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => []),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const inviteButton = await screen.findByRole("button", {
        name: /ORG\$INVITE_ORGANIZATION_MEMBER/i,
      });

      expect(inviteButton).toBeInTheDocument();
      expect(inviteButton).not.toBeDisabled();
    });

    it("should show invite button when user has canInviteUsers permission (Admin role)", async () => {
      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: false,
        canDeleteOrganization: false,
        canChangeRoleToOwner: false,
        canChangeRoleToAdmin: false,
        canChangeRoleToUser: false,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => []),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const inviteButton = await screen.findByRole("button", {
        name: /ORG\$INVITE_ORGANIZATION_MEMBER/i,
      });

      expect(inviteButton).toBeInTheDocument();
      expect(inviteButton).not.toBeDisabled();
    });

    it("should not show invite button when user lacks canInviteUsers permission (User role)", async () => {
      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: false,
        canAddCredits: false,
        canDeleteOrganization: false,
        canChangeRoleToOwner: false,
        canChangeRoleToAdmin: false,
        canChangeRoleToUser: false,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => []),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const inviteButton = screen.queryByRole("button", {
        name: /ORG\$INVITE_ORGANIZATION_MEMBER/i,
      });

      expect(inviteButton).not.toBeInTheDocument();
    });

    it("should open invite modal when invite button is clicked (with permission)", async () => {
      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: false,
        canDeleteOrganization: false,
        canChangeRoleToOwner: false,
        canChangeRoleToAdmin: false,
        canChangeRoleToUser: false,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => []),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      expect(screen.queryByTestId("invite-modal")).not.toBeInTheDocument();

      const inviteButton = await screen.findByRole("button", {
        name: /ORG\$INVITE_ORGANIZATION_MEMBER/i,
      });
      await userEvent.click(inviteButton);

      const portalRoot = screen.getByTestId("portal-root");
      expect(
        within(portalRoot).getByTestId("invite-modal"),
      ).toBeInTheDocument();
    });

    it("should not render invite button when user lacks permission", async () => {
      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: false,
        canAddCredits: false,
        canDeleteOrganization: false,
        canChangeRoleToOwner: false,
        canChangeRoleToAdmin: false,
        canChangeRoleToUser: false,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => []),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const inviteButton = screen.queryByRole("button", {
        name: /ORG\$INVITE_ORGANIZATION_MEMBER/i,
      });

      expect(inviteButton).toBeNull();
    });
  });

  describe("Role-based role change permission behavior", () => {
    it("should not allow an owner to change another owner's role", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "1", // Alice is owner in org 1
        email: "alice@acme.org",
        role: "owner",
        status: "active",
      });

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: true,
        canChangeRoleToOwner: true,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "owner",
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const memberListItems = await screen.findAllByTestId("member-item");
      const ownerMember = memberListItems[0]; // First member is owner
      const roleText = within(ownerMember).getByText(/owner/i);
      await userEvent.click(roleText);

      // Verify that the dropdown does not open for another owner
      expect(
        within(ownerMember).queryByTestId("role-dropdown"),
      ).not.toBeInTheDocument();
    });

    it("Owner should see all three role options (owner, admin, user) in dropdown when changing admin's role", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "1", // Alice is owner in org 1
        email: "alice@acme.org",
        role: "owner",
        status: "active",
      });

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: true,
        canChangeRoleToOwner: true,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "owner",
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const memberListItems = await screen.findAllByTestId("member-item");
      const adminMember = memberListItems[1]; // Second member is admin (bob@acme.org)

      const roleText = within(adminMember).getByText(/admin/i);
      await userEvent.click(roleText);

      const dropdown = within(adminMember).getByTestId("role-dropdown");

      // Verify all three role options are present
      expect(within(dropdown).getByText(/owner/i)).toBeInTheDocument();
      expect(within(dropdown).getByText(/admin/i)).toBeInTheDocument();
      expect(within(dropdown).getByText(/user/i)).toBeInTheDocument();
    });

    it("Owner should see all three role options (owner, admin, user) in dropdown when changing user's role", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "1", // Alice is owner in org 1
        email: "alice@acme.org",
        role: "owner",
        status: "active",
      });

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: true,
        canChangeRoleToOwner: true,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "owner",
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const memberListItems = await screen.findAllByTestId("member-item");
      // Find charlie@acme.org member by email
      const userMember = memberListItems.find((item) =>
        within(item).queryByText("charlie@acme.org"),
      );
      if (!userMember) {
        throw new Error("Could not find charlie@acme.org member");
      }

      const roleText = within(userMember).getByText(/user/i);
      await userEvent.click(roleText);

      const dropdown = within(userMember).getByTestId("role-dropdown");

      // Verify all three role options are present
      expect(within(dropdown).getByText(/owner/i)).toBeInTheDocument();
      expect(within(dropdown).getByText(/admin/i)).toBeInTheDocument();
      expect(within(dropdown).getByText(/user/i)).toBeInTheDocument();
    });

    it("Admin should see only admin and user options (not owner) in dropdown when changing user's role", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "7", // Ray is admin in org 3
        email: "ray@all-hands.dev",
        role: "admin",
        status: "active",
      });

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: false,
        canChangeRoleToOwner: false,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 2 }); // org 3

      const memberListItems = await screen.findAllByTestId("member-item");
      const userMember = memberListItems[2]; // Third member is user (chuck@all-hands.dev)

      const roleText = within(userMember).getByText(/user/i);
      await userEvent.click(roleText);

      const dropdown = within(userMember).getByTestId("role-dropdown");

      // Verify only admin and user options are present
      expect(within(dropdown).getByText(/admin/i)).toBeInTheDocument();
      expect(within(dropdown).getByText(/user/i)).toBeInTheDocument();
      // Verify owner option is NOT present
      expect(within(dropdown).queryByText(/owner/i)).not.toBeInTheDocument();
    });

    it("Admin should not see owner option in role dropdown for any member", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "7", // Ray is admin in org 3
        email: "ray@all-hands.dev",
        role: "admin",
        status: "active",
      });

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: false,
        canChangeRoleToOwner: false,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 2 }); // org 3

      const memberListItems = await screen.findAllByTestId("member-item");

      // Check user member dropdown
      const userMember = memberListItems[2]; // user member
      const userRoleText = within(userMember).getByText(/user/i);
      await userEvent.click(userRoleText);
      const userDropdown = within(userMember).getByTestId("role-dropdown");
      expect(
        within(userDropdown).queryByText(/owner/i),
      ).not.toBeInTheDocument();
      await userEvent.click(userRoleText); // Close dropdown

      // Check another user member dropdown if exists
      if (memberListItems.length > 3) {
        const anotherUserMember = memberListItems[3]; // another user member
        const anotherUserRoleText =
          within(anotherUserMember).getByText(/user/i);
        await userEvent.click(anotherUserRoleText);
        const anotherUserDropdown =
          within(anotherUserMember).getByTestId("role-dropdown");
        expect(
          within(anotherUserDropdown).queryByText(/owner/i),
        ).not.toBeInTheDocument();
      }
    });

    it("Owner should be able to change admin's role to owner", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "1", // Alice is owner in org 1
        email: "alice@acme.org",
        role: "owner",
        status: "active",
      });

      const updateMemberRoleSpy = vi.spyOn(
        organizationService,
        "updateMemberRole",
      );

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: true,
        canChangeRoleToOwner: true,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "owner",
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const memberListItems = await screen.findAllByTestId("member-item");
      const adminMember = memberListItems[1]; // Second member is admin (bob@acme.org)

      const roleText = within(adminMember).getByText(/admin/i);
      await userEvent.click(roleText);

      const dropdown = within(adminMember).getByTestId("role-dropdown");
      const ownerOption = within(dropdown).getByText(/owner/i);
      await userEvent.click(ownerOption);

      expect(updateMemberRoleSpy).toHaveBeenCalledExactlyOnceWith({
        userId: "2",
        orgId: "1",
        role: "owner",
      });
    });

    it("Owner should be able to change user's role to owner", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "1", // Alice is owner in org 1
        email: "alice@acme.org",
        role: "owner",
        status: "active",
      });

      const updateMemberRoleSpy = vi.spyOn(
        organizationService,
        "updateMemberRole",
      );

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: true,
        canChangeRoleToOwner: true,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "owner",
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const memberListItems = await screen.findAllByTestId("member-item");
      // Find charlie@acme.org member by email
      const userMember = memberListItems.find((item) =>
        within(item).queryByText("charlie@acme.org"),
      );
      if (!userMember) {
        throw new Error("Could not find charlie@acme.org member");
      }

      const roleText = within(userMember).getByText(/user/i);
      await userEvent.click(roleText);

      const dropdown = within(userMember).getByTestId("role-dropdown");
      const ownerOption = within(dropdown).getByText(/owner/i);
      await userEvent.click(ownerOption);

      expect(updateMemberRoleSpy).toHaveBeenCalledExactlyOnceWith({
        userId: "3",
        orgId: "1",
        role: "owner",
      });
    });

    it("Owner should be able to change admin's role to admin (no change)", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "1", // Alice is owner in org 1
        email: "alice@acme.org",
        role: "owner",
        status: "active",
      });

      const updateMemberRoleSpy = vi.spyOn(
        organizationService,
        "updateMemberRole",
      );

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: true,
        canChangeRoleToOwner: true,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "owner",
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 0 });

      const memberListItems = await screen.findAllByTestId("member-item");
      // Find bob@acme.org member by email
      const adminMember = memberListItems.find((item) =>
        within(item).queryByText("bob@acme.org"),
      );
      if (!adminMember) {
        throw new Error("Could not find bob@acme.org member");
      }

      // Owner can change admin's role even to the same role
      const roleText = within(adminMember).getByText(/admin/i);
      await userEvent.click(roleText);

      const dropdown = within(adminMember).getByTestId("role-dropdown");
      const adminOption = within(dropdown).getByText(/admin/i);
      await userEvent.click(adminOption);

      expect(updateMemberRoleSpy).toHaveBeenCalledExactlyOnceWith({
        userId: "2",
        orgId: "1",
        role: "admin",
      });
    });

    it("Admin should be able to change user's role to admin", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "7", // Ray is admin in org 3
        email: "ray@all-hands.dev",
        role: "admin",
        status: "active",
      });

      const updateMemberRoleSpy = vi.spyOn(
        organizationService,
        "updateMemberRole",
      );

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: false,
        canChangeRoleToOwner: false,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 2 }); // org 3

      const memberListItems = await screen.findAllByTestId("member-item");
      // Find stephan@all-hands.dev member by email (index 3)
      const userMember = memberListItems.find((item) =>
        within(item).queryByText("stephan@all-hands.dev"),
      );
      if (!userMember) {
        throw new Error("Could not find stephan@all-hands.dev member");
      }

      const roleText = within(userMember).getByText(/user/i);
      await userEvent.click(roleText);

      const dropdown = within(userMember).getByTestId("role-dropdown");
      const adminOption = within(dropdown).getByText(/admin/i);
      await userEvent.click(adminOption);

      expect(updateMemberRoleSpy).toHaveBeenCalledExactlyOnceWith({
        userId: "9",
        orgId: "3",
        role: "admin",
      });
    });

    it("Admin should be able to change user's role to user (no change)", async () => {
      const getMeSpy = vi.spyOn(organizationService, "getMe");
      getMeSpy.mockResolvedValue({
        id: "7", // Ray is admin in org 3
        email: "ray@all-hands.dev",
        role: "admin",
        status: "active",
      });

      const updateMemberRoleSpy = vi.spyOn(
        organizationService,
        "updateMemberRole",
      );

      vi.mocked(useRolePermissions).mockReturnValue({
        canInviteUsers: true,
        canAddCredits: true,
        canDeleteOrganization: false,
        canChangeRoleToOwner: false,
        canChangeRoleToAdmin: true,
        canChangeRoleToUser: true,
        getAvailableRolesToChangeTo: vi.fn((): OrganizationUserRole[] => [
          "admin",
          "user",
        ]),
      });

      renderManageOrganizationMembers();
      await screen.findByTestId("manage-organization-members-settings");

      await selectOrganization({ orgIndex: 2 }); // org 3

      const memberListItems = await screen.findAllByTestId("member-item");
      // Find stephan@all-hands.dev member by email (index 3, but find by email to be safe)
      const userMember = memberListItems.find((item) =>
        within(item).queryByText("stephan@all-hands.dev"),
      );
      if (!userMember) {
        throw new Error("Could not find stephan@all-hands.dev member");
      }

      const roleText = within(userMember).getByText(/user/i);
      await userEvent.click(roleText);

      const dropdown = within(userMember).getByTestId("role-dropdown");
      const userOption = within(dropdown).getByText(/user/i);
      await userEvent.click(userOption);

      expect(updateMemberRoleSpy).toHaveBeenCalledExactlyOnceWith({
        userId: "9", // stephan@all-hands.dev
        orgId: "3",
        role: "user",
      });
    });
  });
});
