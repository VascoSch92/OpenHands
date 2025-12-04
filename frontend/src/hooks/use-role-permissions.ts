import React from "react";
import { useMe } from "./query/use-me";
import { rolePermissions } from "#/utils/org/permissions";
import { OrganizationUserRole } from "#/types/org";

/**
 * Hook to determine role-based permissions for the current user.
 * Returns an object containing various permission checks.
 *
 * @returns Object containing permission flags
 */
export const useRolePermissions = () => {
  const { data: me } = useMe();

  return React.useMemo(() => {
    const canAddCredits =
      !!me && rolePermissions[me.role].includes("add_credits");
    const canInviteUsers =
      !!me && rolePermissions[me.role].includes("invite_user_to_organization");
    const canDeleteOrganization =
      !!me && rolePermissions[me.role].includes("delete_organization");

    const canChangeRoleToOwner =
      !!me && rolePermissions[me.role].includes("change_user_role:owner");
    const canChangeRoleToAdmin =
      !!me && rolePermissions[me.role].includes("change_user_role:admin");
    const canChangeRoleToUser =
      !!me && rolePermissions[me.role].includes("change_user_role:user");

    /**
     * Get the list of roles that the current user can change a member to.
     * - Owners can change to: owner, admin, user
     * - Admins can change to: admin, user (cannot change to owner)
     */
    const getAvailableRolesToChangeTo = (): OrganizationUserRole[] => {
      const availableRoles: OrganizationUserRole[] = [];

      if (canChangeRoleToOwner) {
        availableRoles.push("owner");
      }
      if (canChangeRoleToAdmin) {
        availableRoles.push("admin");
      }
      if (canChangeRoleToUser) {
        availableRoles.push("user");
      }

      return availableRoles;
    };

    return {
      canAddCredits,
      canInviteUsers,
      canDeleteOrganization,
      canChangeRoleToOwner,
      canChangeRoleToAdmin,
      canChangeRoleToUser,
      getAvailableRolesToChangeTo,
    };
  }, [me]);
};
